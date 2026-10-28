/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  closedPoll,
  draftPoll,
  laterSession,
  liveSession,
  livePoll,
  NOW,
  polls,
  questions,
} from "../../__fixtures__/polls";
import { LivePollsPage } from "../LivePollsPage";

function renderPage(props: Partial<Parameters<typeof LivePollsPage>[0]> = {}) {
  return render(
    <LivePollsPage
      sessions={[liveSession, laterSession]}
      polls={polls}
      questions={questions}
      now={NOW}
      {...props}
    />,
  );
}

const pollButton = (question: string) =>
  screen.getByRole("button", { name: new RegExp(question) });

describe("LivePollsPage: polls", () => {
  it("lists the polls of the session with their status written out", () => {
    renderPage();
    const list = screen.getByRole("region", { name: "Polls" });
    expect(within(list).getByText("3 total")).toBeInTheDocument();
    expect(within(list).getByText("Live")).toBeInTheDocument();
    expect(within(list).getByText("Draft")).toBeInTheDocument();
    expect(within(list).getByText("Closed")).toBeInTheDocument();
    expect(within(list).getByText("100 responses")).toBeInTheDocument();
    expect(
      within(list).getByText("2 options · single choice"),
    ).toBeInTheDocument();
  });

  it("shows the live session banner with the people connected", () => {
    renderPage();
    expect(screen.getByText("Session is live")).toBeInTheDocument();
    expect(
      screen.getByText(/Started 10:02 · 200 attendees connected/),
    ).toBeInTheDocument();
  });

  it("shows the results of the first poll: percent and votes as text", () => {
    renderPage();
    const results = screen.getByRole("list", { name: "Results" });
    const rows = within(results).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Next.js");
    expect(rows[0]).toHaveTextContent("60%");
    expect(rows[0]).toHaveTextContent("60 votes");
    expect(rows[2]).toHaveTextContent("10%");
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/responses · 50% of room/)).toBeInTheDocument();
    expect(screen.getByText("Open for 15 min")).toBeInTheDocument();
  });

  it("announces the response count politely and nothing else", () => {
    const { container } = renderPage();
    const live = container.querySelectorAll('[aria-live="polite"]');
    expect(live).toHaveLength(1);
    expect(live[0]).toHaveTextContent("100");
  });

  it("switches the results when another poll is picked", async () => {
    renderPage();
    await userEvent.click(pollButton(closedPoll.question));
    expect(
      screen.getByRole("heading", { name: closedPoll.question }),
    ).toBeInTheDocument();
    expect(screen.getByText("This poll is closed.")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("closes a live poll", async () => {
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Close poll" }));

    expect(screen.queryByRole("button", { name: "Close poll" })).toBeNull();
    expect(screen.getByText("This poll is closed.")).toBeInTheDocument();
    // The list shows the new status too.
    const row = pollButton(livePoll.question);
    expect(within(row).getByText("Closed")).toBeInTheDocument();
  });

  it("launches a draft: it goes live and can then be closed", async () => {
    renderPage();
    await userEvent.click(pollButton(draftPoll.question));
    expect(
      screen.getByText(
        "Nobody can answer a draft. Launch it when you are ready.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Launch poll" }));
    expect(
      within(pollButton(draftPoll.question)).getByText("Live"),
    ).toBeInTheDocument();
    expect(screen.getByText("Open for 0 min")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close poll" }),
    ).toBeInTheDocument();
  });

  it("has no Close or Launch button on a closed poll", async () => {
    renderPage();
    await userEvent.click(pollButton(closedPoll.question));
    expect(screen.queryByRole("button", { name: "Close poll" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Launch poll" })).toBeNull();
  });

  it("toggles showing results to the audience", async () => {
    renderPage();
    const checkbox = screen.getByRole("checkbox", {
      name: "Show results to audience",
    });
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("shows the polls of the other session, and that it is not live", async () => {
    renderPage();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Session" }),
      laterSession.id,
    );
    expect(
      screen.getByText("No polls for this session yet"),
    ).toBeInTheDocument();
    expect(screen.getByText("Session is not live")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Results" })).toBeNull();
  });

  it("lists the sessions with their start in the select", () => {
    renderPage();
    expect(
      screen.getByRole("option", {
        name: "Live talk · 4 December 2026, 10:00",
      }),
    ).toBeInTheDocument();
  });
});

describe("LivePollsPage: audience questions", () => {
  const list = () => screen.getByRole("region", { name: "Audience questions" });

  it("lists the questions most upvoted first, with author and age", () => {
    renderPage();
    const items = within(list()).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Most upvoted question?");
    expect(items[0]).toHaveTextContent("Rahul S. · 10 min ago");
    expect(items[1]).toHaveTextContent("Newest question?");
    expect(items[1]).toHaveTextContent("Anonymous · 2 min ago");
  });

  it("sorts by newest", async () => {
    renderPage();
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort questions" }),
      "new",
    );
    const items = within(list()).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Newest question?");
  });

  it("marks a question answered and can undo it", async () => {
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: /Mark answered: Most upvoted/ }),
    );
    expect(within(list()).getByText("Answered")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: /Mark as not answered: Most upvoted/,
      }),
    );
    expect(within(list()).queryByText("Answered")).toBeNull();
  });

  it("shows an empty state without questions", () => {
    renderPage({ questions: [] });
    expect(screen.getByText("No questions yet")).toBeInTheDocument();
  });
});

describe("LivePollsPage: create a poll", () => {
  const form = () => screen.getByRole("region", { name: "Create a poll" });

  it("saves a valid poll as a draft and shows it in the list", async () => {
    renderPage();
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Question" }),
      "Pick one",
    );
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Option 1" }),
      "Red",
    );
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Option 2" }),
      "Blue",
    );
    await userEvent.click(
      within(form()).getByRole("button", { name: "Save as draft" }),
    );

    const row = pollButton("Pick one");
    expect(within(row).getByText("Draft")).toBeInTheDocument();
    expect(
      within(row).getByText("2 options · single choice"),
    ).toBeInTheDocument();
    // The new poll is selected and the form is empty again.
    expect(
      screen.getByRole("heading", { name: "Pick one" }),
    ).toBeInTheDocument();
    expect(
      within(form()).getByRole("textbox", { name: "Question" }),
    ).toHaveValue("");
  });

  it("launches a poll right away", async () => {
    renderPage();
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Question" }),
      "Go live",
    );
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Option 1" }),
      "Yes",
    );
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Option 2" }),
      "No",
    );
    await userEvent.click(
      within(form()).getByRole("button", { name: "Launch now" }),
    );
    expect(within(pollButton("Go live")).getByText("Live")).toBeInTheDocument();
  });

  it("asks for the question and every option, and adds nothing", async () => {
    renderPage();
    await userEvent.click(
      within(form()).getByRole("button", { name: "Save as draft" }),
    );
    expect(await screen.findByText("Write the question")).toBeInTheDocument();
    expect(screen.getAllByText("Write this option or remove it")).toHaveLength(
      2,
    );
    expect(screen.getByText("3 total")).toBeInTheDocument();
  });

  it("refuses the same option twice", async () => {
    renderPage();
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Question" }),
      "Dupes",
    );
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Option 1" }),
      "Same",
    );
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Option 2" }),
      "same",
    );
    await userEvent.click(
      within(form()).getByRole("button", { name: "Save as draft" }),
    );
    expect(
      await screen.findByText("This option is already in the list"),
    ).toBeInTheDocument();
  });

  it("adds and removes options within the limits", async () => {
    renderPage();
    const remove = () =>
      within(form()).getAllByRole("button", { name: /Remove option/ });
    expect(remove()).toHaveLength(2);
    // The minimum of 2 options cannot be removed.
    expect(remove()[0]).toBeDisabled();

    await userEvent.click(
      within(form()).getByRole("button", { name: "Add option" }),
    );
    expect(remove()).toHaveLength(3);
    await userEvent.click(remove()[2]);
    expect(remove()).toHaveLength(2);

    for (let i = 0; i < 4; i += 1) {
      await userEvent.click(
        within(form()).getByRole("button", { name: "Add option" }),
      );
    }
    expect(remove()).toHaveLength(6);
    expect(
      within(form()).getByRole("button", { name: "Add option" }),
    ).toBeDisabled();
  });

  it("needs no options for a rating poll", async () => {
    renderPage();
    await userEvent.type(
      within(form()).getByRole("textbox", { name: "Question" }),
      "Rate it",
    );
    await userEvent.selectOptions(
      within(form()).getByRole("combobox", { name: "Answer type" }),
      "rating",
    );
    expect(
      within(form()).queryByRole("textbox", { name: "Option 1" }),
    ).toBeNull();
    await userEvent.click(
      within(form()).getByRole("button", { name: "Save as draft" }),
    );
    expect(
      within(pollButton("Rate it")).getByText("1–5 rating"),
    ).toBeInTheDocument();
  });
});

describe("LivePollsPage: states", () => {
  it("shows the loading state", () => {
    renderPage({ isLoading: true });
    expect(
      screen.getByRole("status", { name: "Loading polls" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Polls" })).toBeNull();
  });

  it("shows the error with a Try again button", async () => {
    const onRetry = jest.fn();
    renderPage({ error: "Network down", onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows an empty state when the speaker has no sessions", () => {
    renderPage({ sessions: [] });
    expect(
      screen.getByText("No sessions to run polls for"),
    ).toBeInTheDocument();
  });

  it("makes no network call", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;
    renderPage();
    await userEvent.click(screen.getByRole("button", { name: "Close poll" }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("works with its own sample data", () => {
    render(<LivePollsPage />);
    expect(
      screen.getByRole("heading", { name: "Live polls & Q&A" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Session is live")).toBeInTheDocument();
    expect(screen.getByText(/4 total/)).toBeInTheDocument();
  });
});
