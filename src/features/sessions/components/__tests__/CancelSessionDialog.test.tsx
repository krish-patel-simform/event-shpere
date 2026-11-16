/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cancelledKeynote, talk } from "../../__fixtures__/organizer-sessions";
import type { SessionDto } from "../../schemas/sessions.schemas";
import { CancelSessionDialog } from "../CancelSessionDialog";

function renderDialog(
  props: {
    session?: SessionDto | null;
    isPending?: boolean;
    error?: string | null;
  } = {},
) {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  render(
    <CancelSessionDialog
      session={talk}
      isPending={false}
      error={null}
      onClose={onClose}
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return { onClose, onConfirm };
}

describe("CancelSessionDialog", () => {
  it("is closed without a session", () => {
    renderDialog({ session: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says what cancelling does: the session stays, the hall is freed, seats are cancelled", () => {
    renderDialog();

    const dialog = within(
      screen.getByRole("dialog", { name: "Cancel this session?" }),
    );
    expect(dialog.getByText("Offline-first Event Apps")).toBeInTheDocument();
    expect(dialog.getByText(/stays in the list, marked/)).toBeInTheDocument();
    expect(
      dialog.getByText(/Hall A is free for another session/),
    ).toBeInTheDocument();
    expect(dialog.getByText(/can.t be undone/)).toBeInTheDocument();
  });

  it("does not mention a hall for an online session", () => {
    renderDialog({ session: cancelledKeynote });

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByText(/is free for another session/)).toBeNull();
    expect(
      dialog.getByText(/seats booked for it are cancelled/),
    ).toBeInTheDocument();
  });

  it("confirms with the session, and closes without confirming on Keep session", async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Keep session" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel session" }));
    expect(onConfirm).toHaveBeenCalledWith(talk);
  });

  it("shows the progress, and blocks a second click while cancelling", () => {
    renderDialog({ isPending: true });

    expect(screen.getByRole("button", { name: "Cancelling…" })).toBeDisabled();
  });

  it("shows why it failed, and stays open", () => {
    renderDialog({
      error: "A session that has ended can no longer be cancelled",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A session that has ended can no longer be cancelled",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
