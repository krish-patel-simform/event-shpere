"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ApiError } from "../../../core/api-client/base-api.service";
import { sessionApiService } from "../api/session-api.service";
import type { SessionDto } from "../schemas/sessions.schemas";
import { withSessionMoved, type SessionMove } from "../utils/schedule-sessions";
import {
  invalidateSession,
  sessionMutationKeys,
  sessionQueryKeys,
} from "./session-cache";

type MoveVariables = {
  sessionId: string;
  move: SessionMove;
  /** The new hall's name, so the list shows it while the move is saved. */
  hallName: string | null;
};

/**
 * Moves a session on the schedule board: another hall, another time or another day. The board
 * shows the move at once (the event's session list is updated before the server answers); if the
 * server refuses (409 HALL_BUSY, SPEAKER_BUSY, SESSION_ENDED ...) that session goes back to where
 * it was and the error carries the server's reason.
 *
 * Several moves can be saved at the same time, each its own request, so each must only ever touch
 * its own session: a refusal puts back that one session (never the whole list, which would also
 * undo another move still being saved), and the list is read from the server again only when the
 * last of them has finished (an earlier read would bring back the old place of a move that has
 * not been saved yet). The board keeps a new move off the places these sessions hold or came from.
 */
export function useMoveSession(eventId: string) {
  const queryClient = useQueryClient();
  const listKey = sessionQueryKeys.list(eventId);
  const mutationKey = sessionMutationKeys.move(eventId);

  return useMutation<
    SessionDto,
    ApiError,
    MoveVariables,
    { before: SessionDto | undefined }
  >({
    mutationKey,
    mutationFn: ({ sessionId, move }) =>
      sessionApiService.update(eventId, sessionId, move),
    onMutate: async ({ sessionId, move, hallName }) => {
      // A list that is still loading must not arrive after the move and undo it.
      await queryClient.cancelQueries({ queryKey: listKey });
      const list = queryClient.getQueryData<SessionDto[]>(listKey);
      if (list) {
        queryClient.setQueryData(
          listKey,
          withSessionMoved(list, sessionId, move, hallName),
        );
      }
      // Only this session as it was: what to put back if the server refuses.
      return { before: list?.find((session) => session.id === sessionId) };
    },
    onError: (_error, { sessionId }, context) => {
      const before = context?.before;
      if (!before) return;
      queryClient.setQueryData<SessionDto[]>(listKey, (list) =>
        list?.map((session) => (session.id === sessionId ? before : session)),
      );
    },
    onSettled: (_data, _error, { sessionId }) => {
      // This mutation still counts as running here, so more than one means others are not done.
      if (queryClient.isMutating({ mutationKey }) > 1) {
        return queryClient.invalidateQueries({
          queryKey: sessionQueryKeys.detail(eventId, sessionId),
        });
      }
      return invalidateSession(queryClient, eventId, sessionId);
    },
  });
}
