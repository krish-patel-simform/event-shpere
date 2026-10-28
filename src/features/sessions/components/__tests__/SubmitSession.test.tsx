/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SESSION_ABSTRACT_MIN } from "../../constants";
import { SESSION_ROUTES } from "../../routes";
import type { SessionSubmission } from "../../schemas/session-submission.schema";
import { SessionSubmissionForm } from "../SessionSubmissionForm";
import { SubmitSession } from "../SubmitSession";

const ABSTRACT = "a".repeat(SESSION_ABSTRACT_MIN);
const NOTHING_SENT = "Sample data: nothing was sent to the server";

/** Pasting is much faster than typing 300 characters key by key. */
async function paste(label: string | RegExp, text: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.paste(text);
}

async function fillValidForm() {
  await paste("Session title", "Offline-first Event Apps");
  await userEvent.selectOptions(screen.getByLabelText("Track"), "mobile-web");
  await paste("Abstract", ABSTRACT);
  await paste("Takeaway 1", "Choose a caching strategy");
  await userEvent.click(screen.getByLabelText("Thu, 3 Dec"));
}

const submitButton = () =>
  screen.getByRole("button", { name: "Submit for review" });

describe("SubmitSession (page)", () => {
  it("shows the heading, the breadcrumb, the call and the guidelines", () => {
    render(<SubmitSession />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Submit a session" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My sessions" })).toHaveAttribute(
      "href",
      SESSION_ROUTES.list,
    );
    expect(screen.getByText("Call for sessions closes")).toBeInTheDocument();
    expect(screen.getByText("15 November 2026")).toBeInTheDocument();
    expect(screen.getByText("20 days remaining")).toBeInTheDocument();
    expect(screen.getByText("Submission guidelines")).toBeInTheDocument();
    expect(screen.getByText("Review process")).toBeInTheDocument();
    expect(screen.getByText("Sample data")).toBeInTheDocument();
  });

  it("counts the days from the given time", () => {
    render(<SubmitSession now="2026-11-14T10:00:00.000Z" />);
    expect(screen.getByText("2 days remaining")).toBeInTheDocument();
  });
});

describe("SessionSubmissionForm", () => {
  it("starts with sensible defaults and no errors", () => {
    render(<SessionSubmissionForm />);
    expect(screen.getByLabelText("Format")).toHaveValue("talk");
    expect(screen.getByLabelText("Duration")).toHaveValue("30");
    expect(screen.getByRole("radio", { name: "Intermediate" })).toBeChecked();
    expect(screen.queryByText("Enter a title")).not.toBeInTheDocument();
  });

  it("shows an inline error for every missing required field and does not submit", async () => {
    const onSubmit = jest.fn();
    render(<SessionSubmissionForm onSubmit={onSubmit} />);
    await userEvent.click(submitButton());

    expect(await screen.findByText("Enter a title")).toBeInTheDocument();
    expect(screen.getByText("Choose a track")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Abstract must be at least 300 characters (currently 0).",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Add at least one takeaway")).toBeInTheDocument();
    expect(
      screen.getByText("Pick at least one day you can present"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Session title")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByText(NOTHING_SENT)).not.toBeInTheDocument();
  });

  it("moves focus to the first invalid field", async () => {
    render(<SessionSubmissionForm />);
    await userEvent.click(submitButton());
    await screen.findByText("Enter a title");
    expect(screen.getByLabelText("Session title")).toHaveFocus();
  });

  it("tells the speaker how long the abstract is when it is too short", async () => {
    render(<SessionSubmissionForm />);
    await paste("Abstract", "a".repeat(236));
    await userEvent.click(submitButton());
    expect(
      await screen.findByText(
        "Abstract must be at least 300 characters (currently 236).",
      ),
    ).toBeInTheDocument();
  });

  it("counts the title and the abstract characters as the speaker types", async () => {
    render(<SessionSubmissionForm />);
    await paste("Session title", "Hello");
    expect(screen.getByText(/5 \/ 80/)).toBeInTheDocument();
    await paste("Abstract", "abc");
    expect(screen.getByText(/3 \/ 1200/)).toBeInTheDocument();
  });

  it("refuses a title longer than 80 characters", async () => {
    render(<SessionSubmissionForm />);
    await paste("Session title", "x".repeat(81));
    await userEvent.click(submitButton());
    expect(
      await screen.findByText(/Keep the title under 80 characters/),
    ).toBeInTheDocument();
  });

  it("refuses a lightning talk longer than 30 minutes", async () => {
    render(<SessionSubmissionForm />);
    await fillValidForm();
    await userEvent.selectOptions(screen.getByLabelText("Format"), "lightning");
    await userEvent.selectOptions(screen.getByLabelText("Duration"), "45");
    await userEvent.click(submitButton());
    expect(
      await screen.findByText("A lightning talk is at most 30 minutes"),
    ).toBeInTheDocument();
  });

  it("refuses a malformed co-speaker email and a link that is not http(s)", async () => {
    render(<SessionSubmissionForm />);
    await fillValidForm();
    await paste(/Co-speaker email/, "vikram");
    await paste(/Link to an outline/, "ftp://example.com");
    await userEvent.click(submitButton());
    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(screen.getByText(/starts with http/)).toBeInTheDocument();
  });

  it("submits valid answers once, with the checked values, and says nothing was sent", async () => {
    // jsdom has no fetch: a stand-in that must never be called.
    const originalFetch = globalThis.fetch;
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy;
    const onSubmit = jest.fn<void, [SessionSubmission]>();
    render(<SessionSubmissionForm onSubmit={onSubmit} />);
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(await screen.findByText(NOTHING_SENT)).toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: "Offline-first Event Apps",
      format: "talk",
      duration: "30",
      track: "mobile-web",
      level: "intermediate",
      abstract: ABSTRACT,
      takeaways: ["Choose a caching strategy", "", ""],
      availability: ["2026-12-03"],
    });
    expect(
      screen.getByRole("link", { name: "Back to my sessions" }),
    ).toHaveAttribute("href", SESSION_ROUTES.list);
    expect(fetchSpy).not.toHaveBeenCalled();
    globalThis.fetch = originalFetch;
  });

  it("works with no onSubmit at all (default: nothing is sent anywhere)", async () => {
    render(<SessionSubmissionForm />);
    await fillValidForm();
    await userEvent.click(submitButton());
    expect(await screen.findByText(NOTHING_SENT)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /not submitted for review/,
    );
  });

  it("disables the button and shows it is pending while the submit runs", async () => {
    let finish: () => void = () => undefined;
    const onSubmit = jest.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    render(<SessionSubmissionForm onSubmit={onSubmit} />);
    await fillValidForm();
    await userEvent.click(submitButton());

    const pending = await screen.findByRole("button", { name: "Submitting…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");

    finish();
    expect(await screen.findByText(NOTHING_SENT)).toBeInTheDocument();
    expect(submitButton()).toBeEnabled();
  });

  it("keeps the answers and shows an error when the submit fails", async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error("boom"));
    render(<SessionSubmissionForm onSubmit={onSubmit} />);
    await fillValidForm();
    await userEvent.click(submitButton());

    expect(
      await screen.findByText("We couldn't send your session"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Session title")).toHaveValue(
      "Offline-first Event Apps",
    );
    expect(screen.queryByText(NOTHING_SENT)).not.toBeInTheDocument();
  });

  it("saves a draft with only a title, and does not need the rest", async () => {
    const onSaveDraft = jest.fn();
    const onSubmit = jest.fn();
    render(
      <SessionSubmissionForm onSaveDraft={onSaveDraft} onSubmit={onSubmit} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save as draft" }),
    );
    expect(await screen.findByText("Enter a title")).toBeInTheDocument();
    expect(onSaveDraft).not.toHaveBeenCalled();

    await paste("Session title", "My idea");
    await userEvent.click(
      screen.getByRole("button", { name: "Save as draft" }),
    );
    expect(await screen.findByText(NOTHING_SENT)).toBeInTheDocument();
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onSaveDraft.mock.calls[0][0]).toMatchObject({ title: "My idea" });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/draft was not saved/);
  });

  it("has a Cancel link back to My sessions", () => {
    render(<SessionSubmissionForm />);
    expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      SESSION_ROUTES.list,
    );
  });

  it("says file upload is not available instead of offering it", () => {
    render(<SessionSubmissionForm />);
    expect(
      screen.getByText(/File upload is not available yet/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Browse files")).not.toBeInTheDocument();
  });
});
