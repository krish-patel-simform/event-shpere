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

// The dialogs for cancelling and deleting. No screen opens them yet: their endpoints come next.

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
});
