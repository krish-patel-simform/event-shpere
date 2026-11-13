/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FINTECH_ID,
  SAMPLE_EVENTS,
  SUMMIT_ID,
} from "../../__fixtures__/event-manage";
import { CancelEventDialog, DeleteDraftDialog } from "../EventDialogs";

// The dialogs for cancelling and deleting. My events and the overview open both.

const summit = SAMPLE_EVENTS.find((event) => event.id === SUMMIT_ID)!;
const fintech = SAMPLE_EVENTS.find((event) => event.id === FINTECH_ID)!;

describe("CancelEventDialog", () => {
  it("is closed without an event", () => {
    render(
      <CancelEventDialog
        event={null}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says what cancelling does, and who is told", () => {
    render(
      <CancelEventDialog
        event={summit}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    const dialog = within(
      screen.getByRole("dialog", { name: "Cancel this event?" }),
    );
    expect(
      dialog.getByText("Product Engineering Summit 2026"),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(/480 registered attendees will be notified/),
    ).toBeInTheDocument();
    expect(dialog.getByText(/can.t be undone/)).toBeInTheDocument();
  });

  it("does not mention attendees when nobody registered", () => {
    render(
      <CancelEventDialog
        event={{ ...summit, registered: 0 }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByText(/will be notified/)).not.toBeInTheDocument();
  });

  it("says every session is cancelled with the event, and its halls are free again", () => {
    render(
      <CancelEventDialog
        event={{
          ...summit,
          sessions: { total: 5, scheduled: 4, cancelled: 1 },
        }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    // Only the sessions that are still on count: one was cancelled already.
    expect(
      screen.getByText(
        "All 4 of its sessions are cancelled too, and their halls are free again.",
      ),
    ).toBeInTheDocument();
  });

  it("says it in the singular for a single session", () => {
    render(
      <CancelEventDialog
        event={{
          ...summit,
          sessions: { total: 1, scheduled: 1, cancelled: 0 },
        }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Its only session is cancelled too, and its hall is free again.",
      ),
    ).toBeInTheDocument();
  });

  it("says nothing about sessions when there is none left to cancel", () => {
    render(
      <CancelEventDialog
        event={{
          ...summit,
          sessions: { total: 2, scheduled: 0, cancelled: 2 },
        }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByText(/cancelled too, and/)).not.toBeInTheDocument();
  });

  it("shows the request running: Cancelling…, and the event cannot be kept meanwhile", () => {
    render(
      <CancelEventDialog
        event={summit}
        isPending
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Keep event" })).toBeDisabled();
  });

  it("hands the event over when confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(
      <CancelEventDialog
        event={summit}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cancel event" }));

    expect(onConfirm).toHaveBeenCalledWith(summit);
  });

  it("closes without confirming when the organizer keeps the event", async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    render(
      <CancelEventDialog
        event={summit}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Keep event" }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("DeleteDraftDialog", () => {
  it("is closed without an event", () => {
    render(
      <DeleteDraftDialog
        event={null}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says its sessions are removed too", () => {
    render(
      <DeleteDraftDialog
        event={fintech}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    const dialog = within(
      screen.getByRole("dialog", { name: "Delete this draft?" }),
    );
    expect(
      dialog.getByText(/and its 2 sessions are removed/),
    ).toBeInTheDocument();
  });

  it("does not mention sessions for a draft that has none", () => {
    render(
      <DeleteDraftDialog
        event={{
          ...fintech,
          sessions: { total: 0, scheduled: 0, cancelled: 0 },
        }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.queryByText(/sessions? (are|is) removed/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/is removed\./)).toBeInTheDocument();
  });

  it("hands the event over when confirmed, and closes when the draft is kept", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(
      <DeleteDraftDialog
        event={fintech}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Keep draft" }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(onConfirm).toHaveBeenCalledWith(fintech);
  });

  it("says its description and images are deleted too", () => {
    render(
      <DeleteDraftDialog
        event={fintech}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.getByText("Its description and all its images are deleted too."),
    ).toBeInTheDocument();
  });

  it("shows it is working, and cannot be kept or confirmed again meanwhile", () => {
    render(
      <DeleteDraftDialog
        event={fintech}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        isPending
      />,
    );

    expect(screen.getByRole("button", { name: "Keep draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
  });
});
