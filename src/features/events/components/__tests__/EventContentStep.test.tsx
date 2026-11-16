/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { renderWithClient } from "../../__fixtures__/render";
import { eventApiService } from "../../api/event-api.service";
import { eventEditHref } from "../../routes";
import type { EventContentDto } from "../../schemas/event-content.schemas";
import { EventContentStep } from "../EventContentStep";

jest.mock("../../api/event-api.service", () => ({
  eventApiService: { getContent: jest.fn(), updateContent: jest.fn() },
}));

const api = jest.mocked(eventApiService);
const eventId = "4e5f6a7b-8c9d-4e0f-a1b2-c3d4e5f6a7b8";

const emptyContent: EventContentDto = {
  tagline: null,
  about: "",
  venueGuide: "",
  highlights: [],
  faqs: [],
  seo: { metaTitle: null, metaDescription: null },
  coverImage: null,
  gallery: [],
};

const savedContent: EventContentDto = {
  tagline: "Two days of talks",
  about: "Engineers from across India.",
  venueGuide: "Ten minutes from the metro.",
  highlights: [{ title: "20+ speakers", description: "From product teams" }],
  faqs: [{ question: "Is lunch included?", answer: "Yes." }],
  seo: { metaTitle: "Tech Conf", metaDescription: "Talks and workshops" },
  coverImage: null,
  gallery: [],
};

/** Renders the step once the content has loaded. */
async function renderLoaded(content: EventContentDto = emptyContent) {
  const onContinue = jest.fn();
  api.getContent.mockResolvedValue(content);
  renderWithClient(
    <EventContentStep eventId={eventId} onContinue={onContinue} />,
  );
  await screen.findByLabelText(/^Tagline/);
  return { onContinue, user: userEvent.setup() };
}

beforeEach(() => jest.resetAllMocks());

describe("EventContentStep: loading", () => {
  it("shows a skeleton while the content loads, and asks for this event's content", () => {
    api.getContent.mockReturnValue(new Promise(() => {}));
    renderWithClient(
      <EventContentStep eventId={eventId} onContinue={jest.fn()} />,
    );

    expect(
      screen.getByRole("status", { name: "Loading content" }),
    ).toBeInTheDocument();
    expect(api.getContent).toHaveBeenCalledWith(eventId);
  });

  it("says so when the content could not be loaded, and tries again", async () => {
    const user = userEvent.setup();
    // Fails on every attempt: the hook retries a failure twice before it shows it.
    api.getContent.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "The content service is down"),
    );
    renderWithClient(
      <EventContentStep eventId={eventId} onContinue={jest.fn()} />,
    );

    expect(
      await screen.findByText("We couldn't load the page content"),
    ).toBeInTheDocument();
    expect(screen.getByText("The content service is down")).toBeInTheDocument();

    api.getContent.mockResolvedValue(emptyContent);
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByLabelText(/^Tagline/)).toBeInTheDocument();
  });

  it("lets the organizer skip the step when the content cannot be loaded", async () => {
    const user = userEvent.setup();
    const onContinue = jest.fn();
    api.getContent.mockRejectedValue(
      new ApiError(503, "CMS_UNAVAILABLE", "Down"),
    );
    renderWithClient(
      <EventContentStep eventId={eventId} onContinue={onContinue} />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Skip for now" }),
    );

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("says so for an event that is not the organizer's (404), without a retry", async () => {
    api.getContent.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Event not found"),
    );
    renderWithClient(
      <EventContentStep eventId={eventId} onContinue={jest.fn()} />,
    );

    expect(await screen.findByText("Event not found")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
    // A 404 is final, so it is asked only once.
    expect(api.getContent).toHaveBeenCalledTimes(1);
  });
});

describe("EventContentStep: the form", () => {
  it("starts empty for an event whose page has no content yet", async () => {
    await renderLoaded();

    expect(screen.getByLabelText(/^Tagline/)).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByText("No highlights yet.")).toBeInTheDocument();
    expect(screen.getByText("No questions yet.")).toBeInTheDocument();
  });

  it("is filled with what was saved", async () => {
    await renderLoaded(savedContent);

    expect(screen.getByLabelText(/^Tagline/)).toHaveValue("Two days of talks");
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Engineers from across India.",
    );
    expect(screen.getByLabelText("Venue guide")).toHaveValue(
      "Ten minutes from the metro.",
    );
    expect(screen.getByLabelText("Highlight 1 title")).toHaveValue(
      "20+ speakers",
    );
    expect(screen.getByLabelText(/Highlight 1 description/)).toHaveValue(
      "From product teams",
    );
    expect(screen.getByLabelText("Question 1")).toHaveValue(
      "Is lunch included?",
    );
    expect(screen.getByLabelText("Answer 1")).toHaveValue("Yes.");
    expect(screen.getByLabelText(/^Meta title/)).toHaveValue("Tech Conf");
  });

  it("counts the characters of the description against the limit", async () => {
    const { user } = await renderLoaded();

    await user.type(screen.getByLabelText("Description"), "Hello");

    expect(screen.getByText(/5 \/ 10,000/)).toBeInTheDocument();
  });

  it("links Back to the details step", async () => {
    await renderLoaded();

    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      eventEditHref(eventId, "details"),
    );
  });
});

describe("EventContentStep: saving", () => {
  it("sends every field to the API, then continues", async () => {
    api.updateContent.mockResolvedValue(savedContent);
    const { user, onContinue } = await renderLoaded(savedContent);

    await user.clear(screen.getByLabelText(/^Tagline/));
    await user.type(screen.getByLabelText(/^Tagline/), "Three days of talks");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect(api.updateContent).toHaveBeenCalledWith(eventId, {
      tagline: "Three days of talks",
      about: "Engineers from across India.",
      venueGuide: "Ten minutes from the metro.",
      highlights: [
        { title: "20+ speakers", description: "From product teams" },
      ],
      faqs: [{ question: "Is lunch included?", answer: "Yes." }],
      seo: { metaTitle: "Tech Conf", metaDescription: "Talks and workshops" },
    });
  });

  it('sends empty texts as "", which clears them on the server', async () => {
    api.updateContent.mockResolvedValue(emptyContent);
    const { user } = await renderLoaded(savedContent);

    await user.clear(screen.getByLabelText(/^Tagline/));
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() => expect(api.updateContent).toHaveBeenCalledTimes(1));
    expect(api.updateContent).toHaveBeenCalledWith(
      eventId,
      expect.objectContaining({ tagline: "" }),
    );
  });

  it("says Saving… while the save runs, and cannot be skipped meanwhile", async () => {
    api.updateContent.mockReturnValue(new Promise(() => {}));
    const { user, onContinue } = await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("shows the server's reason when the save fails, and stays on the step", async () => {
    api.updateContent.mockRejectedValue(
      new ApiError(
        503,
        "CMS_UNAVAILABLE",
        "Could not save right now. Please try again.",
      ),
    );
    const { user, onContinue } = await renderLoaded();

    await user.type(screen.getByLabelText(/^Tagline/), "Hello");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't save the content");
    expect(alert).toHaveTextContent(
      "Could not save right now. Please try again.",
    );
    expect(onContinue).not.toHaveBeenCalled();
    // What was typed is still there.
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue("Hello");
  });

  it("moves on without saving when the step is skipped", async () => {
    const { user, onContinue } = await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(api.updateContent).not.toHaveBeenCalled();
  });
});

describe("EventContentStep: validation", () => {
  it("refuses a description over the limit, and does not call the API", async () => {
    const { user, onContinue } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "a".repeat(10_001) },
    });
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText("About must be 10,000 characters or fewer"),
    ).toBeInTheDocument();
    expect(api.updateContent).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("asks for a title when a highlight row is left empty", async () => {
    const { user } = await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Add highlight" }));
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText("Give the highlight a title"),
    ).toBeInTheDocument();
    expect(api.updateContent).not.toHaveBeenCalled();
  });

  it("asks for both the question and the answer of a FAQ", async () => {
    const { user } = await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(await screen.findByText("Write the question")).toBeInTheDocument();
    expect(screen.getByText("Write the answer")).toBeInTheDocument();
    expect(api.updateContent).not.toHaveBeenCalled();
  });

  it("refuses a meta description over the limit", async () => {
    const { user } = await renderLoaded();

    fireEvent.change(screen.getByLabelText("Meta description"), {
      target: { value: "a".repeat(161) },
    });
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    expect(
      await screen.findByText(
        "Meta description must be 160 characters or fewer",
      ),
    ).toBeInTheDocument();
  });
});

describe("EventContentStep: highlights and FAQs", () => {
  it("adds and removes a highlight", async () => {
    const { user } = await renderLoaded(savedContent);

    await user.click(screen.getByRole("button", { name: "Add highlight" }));
    expect(screen.getByLabelText("Highlight 2 title")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Remove highlight 2" }),
    );
    expect(
      screen.queryByLabelText("Highlight 2 title"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Highlight 1 title")).toHaveValue(
      "20+ speakers",
    );
  });

  it("stops offering new highlights at the limit of 8", async () => {
    const eight = Array.from({ length: 8 }, (_, index) => ({
      title: `Highlight ${index}`,
      description: "",
    }));
    await renderLoaded({ ...emptyContent, highlights: eight });

    expect(
      screen.getByRole("button", { name: "Add highlight" }),
    ).toBeDisabled();
  });

  it("adds a FAQ and sends it with the others", async () => {
    api.updateContent.mockResolvedValue(savedContent);
    const { user } = await renderLoaded(savedContent);

    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.type(screen.getByLabelText("Question 2"), "Is there parking?");
    await user.type(screen.getByLabelText("Answer 2"), "Yes, it is free.");
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() => expect(api.updateContent).toHaveBeenCalledTimes(1));
    expect(api.updateContent).toHaveBeenCalledWith(
      eventId,
      expect.objectContaining({
        faqs: [
          { question: "Is lunch included?", answer: "Yes." },
          { question: "Is there parking?", answer: "Yes, it is free." },
        ],
      }),
    );
  });

  it("removes a FAQ, so it is no longer sent", async () => {
    api.updateContent.mockResolvedValue(emptyContent);
    const { user } = await renderLoaded(savedContent);

    await user.click(screen.getByRole("button", { name: "Remove question 1" }));
    await user.click(screen.getByRole("button", { name: "Save & continue" }));

    await waitFor(() => expect(api.updateContent).toHaveBeenCalledTimes(1));
    expect(api.updateContent).toHaveBeenCalledWith(
      eventId,
      expect.objectContaining({ faqs: [] }),
    );
  });
});
