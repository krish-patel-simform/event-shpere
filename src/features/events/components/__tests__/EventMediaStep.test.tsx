/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { screen, waitFor } from "@testing-library/react";
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
    addGalleryImage: jest.fn(),
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

/** Chooses a file in the input with this label (the input is hidden behind a button). */
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  file: File,
) {
  await user.upload(screen.getByLabelText(label, { selector: "input" }), file);
}

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
  it("adds one image", async () => {
    api.addGalleryImage.mockResolvedValue({ gallery: [image(2)] });
    const user = await renderLoaded();
    const file = png();

    await choose(user, "Add image", file);

    await waitFor(() =>
      expect(api.addGalleryImage).toHaveBeenCalledWith(eventId, file),
    );
  });

  it("refuses a file of the wrong type, without calling the API", async () => {
    const user = await renderLoaded();

    await choose(
      user,
      "Add image",
      new File(["GIF"], "a.gif", { type: "image/gif" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Choose a JPG, PNG or WebP image.",
    );
    expect(api.addGalleryImage).not.toHaveBeenCalled();
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

    expect(screen.getByRole("button", { name: "Add image" })).toBeDisabled();
    expect(screen.getByText(/The gallery is full/)).toBeInTheDocument();
  });

  it("shows the server's reason when the gallery is full on the server (409)", async () => {
    api.addGalleryImage.mockRejectedValue(
      new ApiError(409, "GALLERY_FULL", "The gallery can hold 10 images"),
    );
    const user = await renderLoaded();

    await choose(user, "Add image", png());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The gallery could not be saved");
    expect(alert).toHaveTextContent("The gallery can hold 10 images");
  });
});
