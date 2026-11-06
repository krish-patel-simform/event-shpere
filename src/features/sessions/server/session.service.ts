import "server-only";
import { randomUUID } from "node:crypto";
// Direct file import: the core/http barrel also pulls in the route wrapper and cookies.
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../../core/http/errors";
import {
  textToBlocks,
  type CmsSessionDetail,
  type StrapiSessionDetailUpdate,
  type StrapiUploadedFile,
} from "../../cms";
import {
  createImageUploader,
  strapiMediaClient,
  strapiSessionClient,
  type StrapiMediaClient,
  type StrapiSessionClient,
} from "../../cms/server";
import {
  eventAccess,
  type EventAccess,
  type EventActor,
  type EventRef,
} from "../../events/server";
import type {
  SessionContentDto,
  SessionCoverDto,
  UpdateSessionContentBody,
} from "../schemas/session-content.schemas";
import type {
  CreateSessionBody,
  ReplaceSessionSpeakersBody,
  SessionDto,
  UpdateSessionBody,
} from "../schemas/sessions.schemas";
import { checkEventHours, checkSessionShape } from "../utils/session-rules";
import { isHallClashError } from "./hall-clash";
import {
  hallBookingService,
  type HallBookingService,
} from "./hall-booking.service";
import {
  toSessionContentDto,
  toSessionCoverDto,
  toSessionDto,
} from "./session.dto";
import {
  sessionRepository,
  type HallRef,
  type SessionPatch,
  type SessionRef,
  type SessionRepository,
} from "./session.repository";
import { SESSION_COVER_POLICY, type ImageUpload } from "./session-cover";
import {
  speakerBookingService,
  type SpeakerBookingService,
} from "./speaker-booking.service";

export type SessionServiceDeps = {
  /** Who may touch which event (the same rule the events feature uses). */
  eventAccess: Pick<EventAccess, "getEventIfOrgOwns">;
  sessionRepository: Pick<
    SessionRepository,
    | "findHall"
    | "findExistingSpeakerIds"
    | "createSession"
    | "listSessionsByEvent"
    | "findSessionInEvent"
    | "setCmsSessionId"
    | "countActiveBookings"
    | "updateSession"
    | "cancelSession"
    | "replaceSessionSpeakers"
  >;
  hallBooking: Pick<HallBookingService, "assertHallFree">;
  /** A speaker cannot be on two sessions at the same time, whatever the hall. */
  speakerBooking: Pick<SpeakerBookingService, "assertSpeakersFree">;
  /** The session's Session Detail in Strapi: its text and media content. */
  strapiClient: Pick<
    StrapiSessionClient,
    | "createSessionDetail"
    | "deleteSessionDetail"
    | "findSessionDetailById"
    | "updateSessionDetail"
  >;
  /** Strapi's media library: the cover upload and removing replaced files. */
  mediaClient: Pick<StrapiMediaClient, "uploadFiles" | "deleteFile">;
  /** The current time; injected in tests. */
  now?: () => Date;
};

const cmsUnavailable = () =>
  new ServiceUnavailableError(
    "CMS_UNAVAILABLE",
    "The session content is not available right now. Please try again.",
  );

const invalidCover = () =>
  new ValidationError(
    "The cover must be one JPEG, PNG or WebP image of at most 4 MB",
  );

/** Body → what Strapi gets: only the keys that were sent, the description turned into blocks. */
function toStrapiUpdate(
  body: UpdateSessionContentBody,
): StrapiSessionDetailUpdate {
  const data: StrapiSessionDetailUpdate = {};
  // "" and null both clear a text.
  if (body.description !== undefined) {
    data.description = body.description ? textToBlocks(body.description) : null;
  }
  if (body.prerequisites !== undefined) {
    data.prerequisites = body.prerequisites || null;
  }
  if (body.resources !== undefined) {
    data.resources = body.resources.map((item) => ({
      label: item.label,
      url: item.url,
    }));
  }
  return data;
}

/**
 * Everything the organizer does with an event's sessions, in Postgres (the session itself: hall,
 * time, speakers) and Strapi (its Session Detail: description, cover, resources).
 */
export function createSessionService(deps: SessionServiceDeps) {
  const repo = deps.sessionRepository;
  const now = deps.now ?? (() => new Date());

  /** The empty (published) Session Detail in Strapi. Any failure → 503, nothing saved. */
  async function createCmsSessionDetail(sessionId: string) {
    try {
      return await deps.strapiClient.createSessionDetail({ sessionId });
    } catch (error) {
      console.error(
        "[sessions] Strapi session detail not created:",
        error instanceof Error ? error.message : error,
      );
      throw new ServiceUnavailableError(
        "CMS_UNAVAILABLE",
        "Could not create the session right now. Please try again.",
      );
    }
  }

  /** A Strapi call the request cannot do without: any failure → 503, and the caller stops. */
  async function requireCms<T>(
    what: string,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      console.error(
        `[sessions] Strapi ${what} failed:`,
        error instanceof Error ? error.message : error,
      );
      throw cmsUnavailable();
    }
  }

  /**
   * The session's current Strapi entry. A Strapi failure is a 503, never an empty form: an
   * empty form saved back would wipe the real content.
   */
  async function loadDetail(
    session: SessionRef,
  ): Promise<CmsSessionDetail | null> {
    const { cmsSessionId } = session;
    if (!cmsSessionId) return null;
    return requireCms("load", () =>
      deps.strapiClient.findSessionDetailById(cmsSessionId),
    );
  }

  /**
   * Writes `data` to the session's Strapi entry and returns the result. Repairs a missing link
   * on the way: no entry linked yet, or the entry was deleted in Strapi → a new one is created
   * and linked first.
   */
  async function saveToCms(
    session: SessionRef,
    data: StrapiSessionDetailUpdate,
  ): Promise<CmsSessionDetail> {
    const { cmsSessionId } = session;
    if (cmsSessionId) {
      const updated = await requireCms("update", () =>
        deps.strapiClient.updateSessionDetail(cmsSessionId, data),
      );
      if (updated) return updated;
      console.error(
        `[sessions] Strapi session detail ${cmsSessionId} is missing; creating a new one`,
      );
    }

    const created = await requireCms("create", () =>
      deps.strapiClient.createSessionDetail({ sessionId: session.id }),
    );
    await repo.setCmsSessionId(session.id, created.documentId);
    const updated = await requireCms("update", () =>
      deps.strapiClient.updateSessionDetail(created.documentId, data),
    );
    if (!updated) throw cmsUnavailable();
    return updated;
  }

  /**
   * The hall a session may take, or an error: the event needs a venue, and the hall must be in
   * it (a hall of another venue is "not found", the same as one that does not exist), active,
   * and free during the slot (assertHallFree only compares times). `exceptSessionId` is the
   * session being edited, so it does not clash with its own old slot. Creating and editing
   * share this, so they cannot disagree.
   */
  async function assertHallUsable(
    event: Pick<EventRef, "venueId">,
    hallId: string,
    slot: { startAt: Date; endAt: Date },
    exceptSessionId?: string,
  ): Promise<HallRef> {
    if (!event.venueId) {
      throw new ConflictError(
        "EVENT_HAS_NO_VENUE",
        "Choose a venue for the event before adding a session in a hall",
      );
    }
    const hall = await repo.findHall(hallId);
    if (!hall || hall.venueId !== event.venueId) {
      throw new NotFoundError("Hall not found");
    }
    if (!hall.isActive) {
      throw new ConflictError(
        "HALL_INACTIVE",
        "This hall is inactive. Choose an active hall",
      );
    }
    await deps.hallBooking.assertHallFree({
      hallId: hall.id,
      startAt: slot.startAt,
      endAt: slot.endAt,
      exceptSessionId,
    });
    return hall;
  }

  /**
   * For a save the DATABASE refused because another save took the hall a moment earlier: the race
   * the check before the save cannot close (see hall-clash). It answers exactly like the normal
   * check does, 409 HALL_BUSY with the busy times, by asking again now that the other session is
   * saved. If the hall is free again (that other session was cancelled in the meantime), it says
   * so plainly instead.
   */
  async function throwHallBusy(
    hallId: string,
    slot: { startAt: Date; endAt: Date },
    exceptSessionId?: string,
  ): Promise<never> {
    await deps.hallBooking.assertHallFree({
      hallId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      exceptSessionId,
    });
    throw new ConflictError(
      "HALL_BUSY",
      "This hall was just booked by someone else. Please try again.",
    );
  }

  /**
   * Every speaker must be a real speaker PROFILE: a user id (or anything else) is refused (400).
   * Creating a session and replacing its speakers share this.
   */
  async function assertSpeakersExist(
    speakers: { speakerId: string }[],
  ): Promise<void> {
    const speakerIds = speakers.map((speaker) => speaker.speakerId);
    const existing = new Set(await repo.findExistingSpeakerIds(speakerIds));
    const missing = speakerIds.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new ValidationError("Some speakers do not exist", {
        speakerIds: missing,
      });
    }
  }

  /** A cancelled or already-ended session is read-only: editing it is refused (409). */
  function assertSessionEditable(session: {
    status: string;
    endAt: Date | null;
  }): void {
    if (session.status === "cancelled") {
      throw new ConflictError(
        "SESSION_CANCELLED",
        "A cancelled session can no longer be edited",
      );
    }
    if (session.endAt && session.endAt <= now()) {
      throw new ConflictError(
        "SESSION_ENDED",
        "A session that has ended can no longer be edited",
      );
    }
  }

  // Streaming an upload to Strapi, checking what it stored and deleting bad files is the same
  // for every feature: it lives in the cms feature. Sessions only bring their limits and wording.
  const { uploadOneImage, removeUploadedFile } = createImageUploader({
    mediaClient: deps.mediaClient,
    policy: SESSION_COVER_POLICY,
    scope: "sessions",
    noun: "cover",
    invalid: invalidCover,
    unavailable: cmsUnavailable,
  });

  /** saveToCms for an image that was just uploaded: if saving fails, the new file is removed. */
  async function saveImageToCms(
    session: SessionRef,
    image: StrapiUploadedFile,
    data: StrapiSessionDetailUpdate,
  ): Promise<CmsSessionDetail> {
    try {
      return await saveToCms(session, data);
    } catch (error) {
      await removeUploadedFile(image.id);
      throw error;
    }
  }

  /**
   * Undo for createCmsSessionDetail when the DB insert did not happen. Best effort: if it fails
   * too, an unused entry stays in Strapi. No sessions row points to it, so EventSphere never
   * shows it; log its id so it can be removed by hand.
   */
  async function removeCmsSessionDetail(documentId: string) {
    try {
      await deps.strapiClient.deleteSessionDetail(documentId);
    } catch (error) {
      console.error(
        `[sessions] orphan Strapi session detail ${documentId} not deleted:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    /**
     * Every session of the event, earliest first. Only for someone who may manage this event
     * (the owner, or an admin); someone else's event is a 404. A cancelled event can still be
     * read (write: false).
     */
    async listSessions(
      eventId: string,
      actor: EventActor,
    ): Promise<SessionDto[]> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
      const sessions = await repo.listSessionsByEvent(eventId);
      return sessions.map(toSessionDto);
    },

    /**
     * One session of the event. A session of another event (or one that does not exist) is a
     * 404: the lookup takes both ids, so it cannot reach across events.
     */
    async getSession(
      eventId: string,
      sessionId: string,
      actor: EventActor,
    ): Promise<SessionDto> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");
      return toSessionDto(session);
    },

    /** The content form's current values (from Strapi). */
    async getContent(
      eventId: string,
      sessionId: string,
      actor: EventActor,
    ): Promise<SessionContentDto> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: false,
      });
      // The session must be in THIS event; the Strapi id is read from that row, never the request.
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");
      return toSessionContentDto(await loadDetail(session));
    },

    /** Saves only the fields that were sent. Returns the full content as saved. */
    async updateContent(
      eventId: string,
      sessionId: string,
      body: UpdateSessionContentBody,
      actor: EventActor,
    ): Promise<SessionContentDto> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, { write: true });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");
      const detail = await saveToCms(session, toStrapiUpdate(body));
      return toSessionContentDto(detail);
    },

    /** Sets (or replaces) the cover image. The old file is removed only after the new one is saved. */
    async replaceCover(
      eventId: string,
      sessionId: string,
      upload: ImageUpload,
      actor: EventActor,
    ): Promise<SessionCoverDto> {
      // Before a single byte goes to Strapi: only someone who may edit this event can upload,
      // and the session must be in it.
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, { write: true });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");
      const current = await loadDetail(session);

      const image = await uploadOneImage(upload);
      const detail = await saveImageToCms(session, image, {
        coverImage: image.id,
      });

      const oldId = current?.coverImage?.id;
      if (oldId && oldId !== image.id) await removeUploadedFile(oldId);

      if (!detail.coverImage) {
        throw new Error(
          `Strapi session detail ${detail.documentId} has no cover after setting one`,
        );
      }
      return toSessionCoverDto(detail.coverImage);
    },

    /** Removes the cover image. No cover is not an error: the result is the same. */
    async removeCover(
      eventId: string,
      sessionId: string,
      actor: EventActor,
    ): Promise<SessionCoverDto> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, { write: true });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");
      const current = await loadDetail(session);
      if (!current?.coverImage) return toSessionCoverDto(null);

      await saveToCms(session, { coverImage: null });
      await removeUploadedFile(current.coverImage.id);
      return toSessionCoverDto(null);
    },

    /**
     * Edits or moves a session: only the fields that were sent change (`null` clears the hall
     * or the join link). The speakers and the Strapi content have their own routes. The
     * permission (SESSION_MANAGE) is checked by the route wrapper; the owning organizer or an
     * admin may edit.
     *
     * Order: the event is theirs → the session is in it, not cancelled, not ended → the saved
     * session with the changes applied ("merged") is valid under the same rules as create → if the
     * time or hall changed: inside the event's dates, and the hall is usable and free (the
     * session's own old slot does not count) → if the time changed: its speakers are free in the
     * new slot → bookings do not get broken → write. Nothing
     * that was not sent is touched, and Strapi is not called.
     */
    async updateSession(
      eventId: string,
      sessionId: string,
      body: UpdateSessionBody,
      actor: EventActor,
    ): Promise<SessionDto> {
      const event = await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");

      assertSessionEditable(session);

      // The session as it would be after the edit: what was sent wins, the rest stays.
      const merged = {
        mode: body.mode ?? session.mode,
        hallId: body.hallId !== undefined ? body.hallId : session.hallId,
        onlineUrl:
          body.onlineUrl !== undefined ? body.onlineUrl : session.onlineUrl,
        startAt: body.startAt ?? session.startAt,
        endAt: body.endAt ?? session.endAt,
      };
      const issues = checkSessionShape(merged);
      const { startAt, endAt } = merged;
      if (issues.length > 0 || !startAt || !endAt) {
        throw new ValidationError(
          issues[0]?.message ?? "Set the start and end time",
          { issues },
        );
      }

      const timeChanged =
        startAt.getTime() !== session.startAt?.getTime() ||
        endAt.getTime() !== session.endAt?.getTime();
      const hallChanged = merged.hallId !== session.hallId;

      // Only a changed slot is held against the event's dates, so editing a title never fails
      // for a reason the organizer did not touch.
      if (timeChanged && (startAt < event.startAt || endAt > event.endAt)) {
        throw new ValidationError(
          "The session must take place within the event's dates",
        );
      }
      // ...and to the hours the event keeps on each of its days.
      const outsideHours = timeChanged
        ? checkEventHours({ startAt, endAt }, event)
        : null;
      if (outsideHours) throw new ValidationError(outsideHours);

      let hall: HallRef | null = null;
      if (merged.hallId && (hallChanged || timeChanged)) {
        hall = await assertHallUsable(
          event,
          merged.hallId,
          { startAt, endAt },
          session.id,
        );
      }

      // Moving the session moves its speakers too: they must be free in the new slot (the
      // session's own old slot does not count).
      if (timeChanged) {
        await deps.speakerBooking.assertSpeakersFree({
          speakerIds: session.speakers.map((speaker) => speaker.speakerId),
          startAt,
          endAt,
          exceptSessionId: session.id,
        });
      }

      // Seats already booked must not be broken by this edit. Counted only when it matters.
      const turnsOffBooking =
        session.requiresRegistration && body.requiresRegistration === false;
      if (turnsOffBooking || hallChanged) {
        const booked = await repo.countActiveBookings(session.id);
        if (booked > 0 && turnsOffBooking) {
          throw new ConflictError(
            "SESSION_HAS_BOOKINGS",
            "This session already has bookings, so it must keep requiring registration",
          );
        }
        const needsSeats =
          body.requiresRegistration ?? session.requiresRegistration;
        if (hall && needsSeats && booked > hall.capacity) {
          throw new ConflictError(
            "HALL_TOO_SMALL",
            "This hall has fewer seats than the session already has bookings",
          );
        }
      }

      // Only the fields that were sent are written.
      const patch: SessionPatch = {};
      if (body.title !== undefined) patch.title = body.title;
      if (body.type !== undefined) patch.type = body.type;
      if (body.mode !== undefined) patch.mode = body.mode;
      if (body.hallId !== undefined) patch.hallId = body.hallId;
      if (body.onlineUrl !== undefined) patch.onlineUrl = body.onlineUrl;
      if (body.startAt !== undefined) patch.startAt = body.startAt;
      if (body.endAt !== undefined) patch.endAt = body.endAt;
      if (body.requiresRegistration !== undefined) {
        patch.requiresRegistration = body.requiresRegistration;
      }
      if (body.price !== undefined) patch.price = body.price;

      let updated: Awaited<ReturnType<typeof repo.updateSession>>;
      try {
        updated = await repo.updateSession(session.id, patch);
      } catch (error) {
        // Two saves for one hall at the same moment: the database let one in, refused this one.
        if (merged.hallId && isHallClashError(error)) {
          return throwHallBusy(merged.hallId, { startAt, endAt }, session.id);
        }
        throw error;
      }
      if (!updated) throw new NotFoundError("Session not found");
      return toSessionDto(updated);
    },

    /**
     * Replaces who presents the session: the whole list is sent, whoever is not in it is removed.
     * Same rules as create (at least one speaker, no repeats, at least one with the role speaker,
     * every id a real speaker PROFILE) and a speaker who is new to the session must be free during
     * its slot (409 SPEAKER_BUSY). The permission (SESSION_MANAGE) is checked by the route
     * wrapper; the owning organizer or an admin may change them. A cancelled or ended session is
     * read-only. Saved in one transaction; the Strapi content is not touched.
     */
    async replaceSpeakers(
      eventId: string,
      sessionId: string,
      body: ReplaceSessionSpeakersBody,
      actor: EventActor,
    ): Promise<SessionDto> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, { write: true });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");
      assertSessionEditable(session);

      await assertSpeakersExist(body.speakers);

      // Only the speakers who are NEW to this session are checked: the others already hold its
      // slot, so an old clash must not stop the organizer from adding a moderator. A session
      // that has no time yet (a draft) holds nobody, so there is nothing to clash with.
      const { startAt, endAt } = session;
      if (startAt && endAt) {
        const already = new Set(
          session.speakers.map((speaker) => speaker.speakerId),
        );
        await deps.speakerBooking.assertSpeakersFree({
          speakerIds: body.speakers
            .map((speaker) => speaker.speakerId)
            .filter((id) => !already.has(id)),
          startAt,
          endAt,
          exceptSessionId: session.id,
        });
      }

      const updated = await repo.replaceSessionSpeakers(
        session.id,
        body.speakers,
      );
      if (!updated) throw new NotFoundError("Session not found");
      return toSessionDto(updated);
    },

    /**
     * Cancels a session: it is kept (not deleted), its hall is free again, and the seats booked
     * for it are cancelled with it. Cancelling is final. The permission (SESSION_MANAGE) is
     * checked by the route wrapper; the owning organizer or an admin may cancel. A session that
     * is already cancelled is answered as it is (cancelling twice is harmless); one that has
     * ended can no longer be cancelled. The speakers and the Strapi content are left alone.
     */
    async cancelSession(
      eventId: string,
      sessionId: string,
      actor: EventActor,
    ): Promise<SessionDto> {
      await deps.eventAccess.getEventIfOrgOwns(eventId, actor, { write: true });
      const session = await repo.findSessionInEvent(eventId, sessionId);
      if (!session) throw new NotFoundError("Session not found");

      if (session.status === "cancelled") return toSessionDto(session);
      if (session.endAt && session.endAt <= now()) {
        throw new ConflictError(
          "SESSION_ENDED",
          "A session that has ended can no longer be cancelled",
        );
      }

      const cancelled = await repo.cancelSession(session.id, now());
      if (cancelled) return toSessionDto(cancelled);

      // Someone cancelled it between the read and the write: the answer is the same.
      const current = await repo.findSessionInEvent(eventId, sessionId);
      if (!current) throw new NotFoundError("Session not found");
      return toSessionDto(current);
    },

    /**
     * An approved organizer adds a session to one of their own events. The permission
     * (SESSION_CREATE) is checked by the route wrapper. An admin may manage sessions but has no
     * organizer profile to own one, so an admin cannot create (refused even if the permission
     * were ever granted).
     *
     * Order: who may touch this event → the slot, hall and speakers are valid → the hall and
     * the speakers are free → empty Session Detail in Strapi → sessions + session_speakers rows in one
     * transaction (same id as the Strapi `sessionId`, linked by cms_session_id). Strapi goes
     * last of the checks so a refused request never touches it; if the insert fails after it,
     * the Strapi entry is removed again.
     */
    async createSession(
      eventId: string,
      body: CreateSessionBody,
      actor: EventActor,
    ): Promise<SessionDto> {
      if (actor.role !== "organizer") {
        throw new ForbiddenError("Only an organizer can add sessions");
      }
      // The event, if the organizer owns it: 404 for someone else's, 409 for a cancelled one.
      const event = await deps.eventAccess.getEventIfOrgOwns(eventId, actor, {
        write: true,
      });

      if (body.startAt < event.startAt || body.endAt > event.endAt) {
        throw new ValidationError(
          "The session must take place within the event's dates",
        );
      }
      // On a multi-day event the range is not enough: each day has its opening and closing time.
      const outsideHours = checkEventHours(body, event);
      if (outsideHours) throw new ValidationError(outsideHours);

      if (body.hallId) {
        await assertHallUsable(event, body.hallId, {
          startAt: body.startAt,
          endAt: body.endAt,
        });
      }

      await assertSpeakersExist(body.speakers);
      // Whatever the hall (or none, online): a speaker cannot be in two places at once.
      await deps.speakerBooking.assertSpeakersFree({
        speakerIds: body.speakers.map((speaker) => speaker.speakerId),
        startAt: body.startAt,
        endAt: body.endAt,
      });

      // One id for both systems: Postgres sessions.id and the Strapi entry's `sessionId`.
      const sessionId = randomUUID();
      const detail = await createCmsSessionDetail(sessionId);

      try {
        const session = await repo.createSession({
          id: sessionId,
          eventId,
          hallId: body.hallId ?? null,
          cmsSessionId: detail.documentId,
          title: body.title,
          type: body.type,
          mode: body.mode,
          // It has a hall (or a link) and a time, so it is on the schedule from the start.
          status: "scheduled",
          onlineUrl: body.onlineUrl ?? null,
          startAt: body.startAt,
          endAt: body.endAt,
          requiresRegistration: body.requiresRegistration,
          price: body.price,
          speakers: body.speakers,
        });
        return toSessionDto(session);
      } catch (error) {
        await removeCmsSessionDetail(detail.documentId);
        // Two saves for one hall at the same moment: the database let one in, refused this one.
        if (body.hallId && isHallClashError(error)) {
          return throwHallBusy(body.hallId, {
            startAt: body.startAt,
            endAt: body.endAt,
          });
        }
        throw error;
      }
    },
  };
}

export type SessionService = ReturnType<typeof createSessionService>;

export const sessionService = createSessionService({
  eventAccess,
  sessionRepository,
  hallBooking: hallBookingService,
  speakerBooking: speakerBookingService,
  strapiClient: strapiSessionClient,
  mediaClient: strapiMediaClient,
});
