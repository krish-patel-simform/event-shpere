/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import {
  EVENT_GALLERY_MAX_IMAGES,
  EVENT_IMAGE_MAX_BYTES,
} from "../../constants";
import { eventEditHref, eventHref } from "../../routes";
import type {
  EventContentDto,
  EventMediaDto,
} from "../../schemas/event-content.schemas";
import { EventMediaStep } from "../EventMediaStep";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: {
    getContent: jest.fn(),
    uploadCover: jest.fn(),
    deleteCover: jest.fn(),
    addGalleryImages: jest.fn(),
    deleteGalleryImage: jest.fn(),
  },
}));

const api = jest.mocked(eventApiService);
const eventId = "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8";

const image = (id: number, alt: string | null = null): EventMediaDto => ({
  id,
  url: `https://cms.example.com/uploads/${id}.jpg`,
  alt,
  width: 1200,
  height: 630,
});

const baseContent: EventContentDto = {
  tagline: null,
  about: "",
  venueGuide: "",
  highlights: [],
  faqs: [],
  seo: { metaTitle: null, metaDescription: null },
  coverImage: null,
  gallery: [],
};

const png = () => new File(["png"], "banner.png", { type: "image/png" });

async function renderLoaded(content: Partial<EventContentDto> = {}) {
  api.getContent.mockResolvedValue({ ...baseContent, ...content });
  renderWithClient(<EventMediaStep eventId={eventId} />);
  await screen.findByRole("heading", { name: "Cover image" });
  // `applyAccept: false`: the input's `accept` is not what is under test. The component checks
  // the type itself, because `accept` only filters the file dialog and can be bypassed.
  return userEvent.setup({ applyAccept: false });
}

/** Chooses a file (or several) in the input with this label (the input is hidden behind a button). */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  file: File | File[],
) {
  await user.upload(screen.getByLabelText(label, { selector: "input" }), file);
}

/** A named image of a given size, for the gallery's selection. */
const picture = (name: string, bytes = 100, type = "image/png") =>
  new File([new Uint8Array(bytes)], name, { type, lastModified: 1 });

beforeEach(() => jest.resetAllMocks());

describe("EventMediaStep: loading", () => {
  it("shows a skeleton while the images load", () => {
    api.getContent.mockReturnValue(new Promise(() => {}));
    renderWithClient(<EventMediaStep eventId={eventId} />);

    expect(
      screen.getByRole("status", { name: "Loading images" }),
    ).toBeInTheDocument();
  });

  it("says so when the images could not be loaded, and tries again", async () => {
    const user = userEvent.setup();
    // Fails on every attempt: the hook retries a failure twice before it shows it.
    api.getContent.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "Down"),
    );
    renderWithClient(<EventMediaStep eventId={eventId} />);

    expect(
      await screen.findByText("We couldn't load the images"),
    ).toBeInTheDocument();

    api.getContent.mockResolvedValue(baseContent);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(
      await screen.findByRole("heading", { name: "Cover image" }),
    ).toBeInTheDocument();
  });

  it("says so for an event that is not the organizer's (404), without a retry", async () => {
    api.getContent.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Event not found"),
    );
    renderWithClient(<EventMediaStep eventId={eventId} />);

    expect(await screen.findByText("Event not found")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});

describe("EventMediaStep: the page", () => {
  it("links Back to the content step and Finish to the overview", async () => {
    await renderLoaded();

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      eventEditHref(eventId, "content"),
    );
    expect(screen.getByRole("link", { name: "Finish" })).toHaveAttribute(
      "href",
      eventHref(eventId),
    );
  });

  it("says there is no cover and no gallery yet", async () => {
    await renderLoaded();

    expect(screen.getByText(/No cover image yet/)).toBeInTheDocument();
    expect(screen.getByText("No gallery images yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload cover" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Remove cover" }),
    ).not.toBeInTheDocument();
  });

  it("shows the saved cover and gallery", async () => {
    await renderLoaded({
      coverImage: image(1, "The main hall"),
      gallery: [image(2), image(3)],
    });

    expect(screen.getByRole("img", { name: "The main hall" })).toHaveAttribute(
      "src",
      "https://cms.example.com/uploads/1.jpg",
    );
    expect(
      screen.getByRole("img", { name: "Gallery image 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Gallery image 2" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 of 10/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Replace cover" }),
    ).toBeInTheDocument();
  });

  it("accepts only the image types the server takes", async () => {
    await renderLoaded();

    expect(
      screen.getByLabelText("Upload cover", { selector: "input" }),
    ).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
  });
});

describe("EventMediaStep: the cover", () => {
  it("uploads the chosen image", async () => {
    api.uploadCover.mockResolvedValue({ coverImage: image(5) });
    const user = await renderLoaded();
    const file = png();

    await choose(user, "Upload cover", file);

    await waitFor(() =>
      expect(api.uploadCover).toHaveBeenCalledWith(eventId, file),
    );
  });

  it("says Uploading… while the image goes up", async () => {
    api.uploadCover.mockReturnValue(new Promise(() => {}));
    const user = await renderLoaded();

    await choose(user, "Upload cover", png());

    expect(
      await screen.findByRole("button", { name: "Uploading…" }),
    ).toBeDisabled();
  });

  it("refuses a file that is not a JPG, PNG or WebP, without calling the API", async () => {
    const user = await renderLoaded();

    await choose(
      user,
      "Upload cover",
      new File(["%PDF"], "plan.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a JPG, PNG or WebP image.",
    );
    expect(api.uploadCover).not.toHaveBeenCalled();
  });

  it("refuses an image over 4 MB, without calling the API", async () => {
    const user = await renderLoaded();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: EVENT_IMAGE_MAX_BYTES + 1 });

    await choose(user, "Upload cover", big);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The image must be 4 MB or smaller.",
    );
    expect(api.uploadCover).not.toHaveBeenCalled();
  });

  it("accepts an image of exactly 4 MB", async () => {
    api.uploadCover.mockResolvedValue({ coverImage: image(5) });
    const user = await renderLoaded();
    const exact = new File(["x"], "exact.png", { type: "image/png" });
    Object.defineProperty(exact, "size", { value: EVENT_IMAGE_MAX_BYTES });

    await choose(user, "Upload cover", exact);

    await waitFor(() => expect(api.uploadCover).toHaveBeenCalledTimes(1));
  });

  it("shows the server's reason when the upload fails", async () => {
    api.uploadCover.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "That file is not an image"),
    );
    const user = await renderLoaded();

    await choose(user, "Upload cover", png());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The cover image could not be saved");
    expect(alert).toHaveTextContent("That file is not an image");
  });

  it("clears an early file message once a good file is chosen", async () => {
    api.uploadCover.mockResolvedValue({ coverImage: image(5) });
    const user = await renderLoaded();

    await choose(
      user,
      "Upload cover",
      new File(["%PDF"], "plan.pdf", { type: "application/pdf" }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await choose(user, "Upload cover", png());

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("removes the cover", async () => {
    api.deleteCover.mockResolvedValue(undefined);
    const user = await renderLoaded({ coverImage: image(1) });

    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    await waitFor(() => expect(api.deleteCover).toHaveBeenCalledWith(eventId));
  });

  it("shows the server's reason when the cover could not be removed", async () => {
    api.deleteCover.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "Try again later"),
    );
    const user = await renderLoaded({ coverImage: image(1) });

    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try again later",
    );
  });
});

describe("EventMediaStep: the gallery", () => {
  const selection = () =>
    within(screen.getByRole("list", { name: "Images selected for upload" }));

  it("only lists the chosen images, with how many and how big, until Upload is pressed", async () => {
    const user = await renderLoaded();

    await choose(user, "Add images", [
      picture("a.png", 1024),
      picture("b.png", 2048),
    ]);

    expect(await screen.findByText(/2 images selected/)).toBeInTheDocument();
    expect(screen.getByText(/3.0 KB of 4.0 MB/)).toBeInTheDocument();
    expect(selection().getByText("a.png")).toBeInTheDocument();
    expect(selection().getByText("b.png")).toBeInTheDocument();
    expect(api.addGalleryImages).not.toHaveBeenCalled();
  });

  it("uploads every chosen image in ONE call, with the count on the button", async () => {
    api.addGalleryImages.mockResolvedValue({ gallery: [image(2), image(3)] });
    const user = await renderLoaded();
    const first = picture("a.png");
    const second = picture("b.png");
    await choose(user, "Add images", [first, second]);

    await user.click(
      await screen.findByRole("button", { name: "Upload 2 images" }),
    );

    await waitFor(() => expect(api.addGalleryImages).toHaveBeenCalledTimes(1));
    expect(api.addGalleryImages).toHaveBeenCalledWith(eventId, [first, second]);
  });

  it("says 'image' for a single one", async () => {
    const user = await renderLoaded();

    await choose(user, "Add images", picture("a.png"));

    expect(
      await screen.findByRole("button", { name: "Upload 1 image" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 image selected/)).toBeInTheDocument();
  });

  it("has no Upload button until something is chosen", async () => {
    await renderLoaded();

    expect(
      screen.queryByRole("button", { name: /^Upload \d/ }),
    ).not.toBeInTheDocument();
  });

  it("adds a second choice to the first one instead of replacing it", async () => {
    const user = await renderLoaded();

    await choose(user, "Add images", picture("a.png"));
    await choose(user, "Add images", picture("b.png"));

    expect(await screen.findByText(/2 images selected/)).toBeInTheDocument();
    expect(selection().getAllByRole("listitem")).toHaveLength(2);
  });

  it("takes an image off the selection before it is uploaded", async () => {
    const user = await renderLoaded();
    await choose(user, "Add images", [picture("a.png"), picture("b.png")]);

    await user.click(
      await screen.findByRole("button", {
        name: "Remove a.png from the selection",
      }),
    );

    expect(screen.getByText(/1 image selected/)).toBeInTheDocument();
    expect(screen.queryByText("a.png")).not.toBeInTheDocument();
  });

  it("clears the selection once the images are saved", async () => {
    api.addGalleryImages.mockResolvedValue({ gallery: [image(2)] });
    const user = await renderLoaded();
    await choose(user, "Add images", picture("a.png"));

    await user.click(
      await screen.findByRole("button", { name: "Upload 1 image" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("list", { name: "Images selected for upload" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /^Upload \d/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps the selection when the upload fails, so it can be tried again", async () => {
    api.addGalleryImages.mockRejectedValueOnce(
      new ApiError(503, "CMS_UNAVAILABLE", "Try again later"),
    );
    api.addGalleryImages.mockResolvedValueOnce({ gallery: [image(2)] });
    const user = await renderLoaded();
    await choose(user, "Add images", picture("a.png"));

    await user.click(
      await screen.findByRole("button", { name: "Upload 1 image" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Try again later",
    );
    expect(selection().getByText("a.png")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Upload 1 image" }));
    await waitFor(() => expect(api.addGalleryImages).toHaveBeenCalledTimes(2));
  });

  it("shows the progress with the count while uploading, and blocks a second click", async () => {
    api.addGalleryImages.mockReturnValue(new Promise(() => {}));
    const user = await renderLoaded();
    await choose(user, "Add images", [picture("a.png"), picture("b.png")]);

    await user.click(
      await screen.findByRole("button", { name: "Upload 2 images" }),
    );

    expect(
      await screen.findByRole("button", { name: "Uploading 2 images…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add images" })).toBeDisabled();
  });

  it("leaves out a file of the wrong type, names it, and keeps the good ones", async () => {
    const user = await renderLoaded();

    await choose(user, "Add images", [
      picture("a.png"),
      new File(["GIF"], "b.gif", { type: "image/gif" }),
    ]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "b.gif: Choose a JPG, PNG or WebP image.",
    );
    expect(screen.getByText(/1 image selected/)).toBeInTheDocument();
    expect(api.addGalleryImages).not.toHaveBeenCalled();
  });

  it("leaves out what would not fit in one upload, and says to upload in more than one go", async () => {
    const user = await renderLoaded();

    await choose(user, "Add images", [
      picture("a.png", 3 * 1024 * 1024),
      picture("b.png", 2 * 1024 * 1024),
    ]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /at most 4 MB of images; 1 image left out/,
    );
    expect(screen.getByText(/1 image selected/)).toBeInTheDocument();
  });

  it("takes only as many as the gallery has room for", async () => {
    const nearlyFull = Array.from(
      { length: EVENT_GALLERY_MAX_IMAGES - 1 },
      (_, index) => image(index + 1),
    );
    const user = await renderLoaded({ gallery: nearlyFull });

    await choose(user, "Add images", [picture("a.png"), picture("b.png")]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "room for 1 more image; 1 image left out",
    );
    expect(screen.getByText(/1 image selected/)).toBeInTheDocument();
  });

  it("removes an image by its id", async () => {
    api.deleteGalleryImage.mockResolvedValue({ gallery: [image(3)] });
    const user = await renderLoaded({ gallery: [image(2), image(3)] });

    await user.click(
      screen.getByRole("button", { name: "Remove gallery image 1" }),
    );

    await waitFor(() =>
      expect(api.deleteGalleryImage).toHaveBeenCalledWith(eventId, 2),
    );
  });

  it("cannot add more once the gallery is full, and says why", async () => {
    const full = Array.from({ length: EVENT_GALLERY_MAX_IMAGES }, (_, index) =>
      image(index + 1),
    );
    await renderLoaded({ gallery: full });

    expect(screen.getByRole("button", { name: "Add images" })).toBeDisabled();
    expect(screen.getByText(/The gallery is full/)).toBeInTheDocument();
  });

  it("shows the server's reason when the images do not fit on the server (409)", async () => {
    api.addGalleryImages.mockRejectedValue(
      new ApiError(409, "GALLERY_FULL", "The gallery can hold 10 images"),
    );
    const user = await renderLoaded();
    await choose(user, "Add images", png());

    await user.click(
      await screen.findByRole("button", { name: "Upload 1 image" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The gallery could not be saved");
    expect(alert).toHaveTextContent("The gallery can hold 10 images");
  });
});

describe("EventMediaStep: Finish while an image is on its way", () => {
  /** A promise the test settles by hand, so the request stays running as long as it needs. */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }

  const finishLink = () => screen.queryByRole("link", { name: "Finish" });
  const finishButton = () => screen.queryByRole("button", { name: "Finish" });

  it("is a link to the overview when nothing is uploading", async () => {
    await renderLoaded();

    expect(finishLink()).toHaveAttribute("href", eventHref(eventId));
    expect(finishButton()).not.toBeInTheDocument();
  });

  it("is disabled while the cover uploads, and a link again once it is saved", async () => {
    const upload = deferred<{ coverImage: EventMediaDto }>();
    api.uploadCover.mockReturnValue(upload.promise);
    const user = await renderLoaded();

    await choose(user, "Upload cover", png());

    await waitFor(() => expect(finishButton()).toBeDisabled());
    expect(finishButton()).not.toHaveAttribute("aria-busy");
    expect(finishLink()).not.toBeInTheDocument();

    upload.resolve({ coverImage: image(5) });

    expect(await screen.findByRole("link", { name: "Finish" })).toHaveAttribute(
      "href",
      eventHref(eventId),
    );
    expect(finishButton()).not.toBeInTheDocument();
  });

  it("is disabled while the cover is being removed", async () => {
    const removal = deferred<undefined>();
    api.deleteCover.mockReturnValue(removal.promise);
    const user = await renderLoaded({ coverImage: image(1) });

    await user.click(screen.getByRole("button", { name: "Remove cover" }));

    await waitFor(() => expect(finishButton()).toBeDisabled());

    removal.resolve(undefined);
    expect(
      await screen.findByRole("link", { name: "Finish" }),
    ).toBeInTheDocument();
  });

  it("is disabled while gallery images upload, with no spinner of its own", async () => {
    const upload = deferred<{ gallery: EventMediaDto[] }>();
    api.addGalleryImages.mockReturnValue(upload.promise);
    const user = await renderLoaded();
    await choose(user, "Add images", [picture("a.png"), picture("b.png")]);

    await user.click(
      await screen.findByRole("button", { name: "Upload 2 images" }),
    );

    await waitFor(() => expect(finishButton()).toBeDisabled());
    // Plain disabled: the progress shows on the Upload button, not on Finish.
    expect(finishButton()).not.toHaveAttribute("aria-busy");

    upload.resolve({ gallery: [image(2), image(3)] });
    expect(
      await screen.findByRole("link", { name: "Finish" }),
    ).toBeInTheDocument();
  });

  it("is disabled while a gallery image is being removed", async () => {
    const removal = deferred<{ gallery: EventMediaDto[] }>();
    api.deleteGalleryImage.mockReturnValue(removal.promise);
    const user = await renderLoaded({ gallery: [image(2)] });

    await user.click(
      screen.getByRole("button", { name: "Remove gallery image 1" }),
    );

    await waitFor(() => expect(finishButton()).toBeDisabled());

    removal.resolve({ gallery: [] });
    expect(
      await screen.findByRole("link", { name: "Finish" }),
    ).toBeInTheDocument();
  });

  it("comes back as a link when the upload fails, so the organizer is not stuck", async () => {
    api.uploadCover.mockRejectedValue(
      new ApiError(400, "VALIDATION_ERROR", "That file is not an image"),
    );
    const user = await renderLoaded();

    await choose(user, "Upload cover", png());

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Finish" }),
    ).toBeInTheDocument();
    expect(finishButton()).not.toBeInTheDocument();
  });

  it("does not wait for a file the early checks refused (nothing was sent)", async () => {
    const user = await renderLoaded();

    await choose(
      user,
      "Upload cover",
      new File(["%PDF"], "plan.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(finishLink()).toBeInTheDocument();
    expect(api.uploadCover).not.toHaveBeenCalled();
  });
});
