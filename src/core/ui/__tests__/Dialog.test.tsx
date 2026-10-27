/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog, DialogBody, DialogFooter } from "../Dialog";

function renderDialog(open: boolean, onClose = jest.fn()) {
  const view = (isOpen: boolean) => (
    <Dialog open={isOpen} onClose={onClose} title="Approve Acme?">
      <DialogBody>
        <p>Body text</p>
        <input aria-label="Reason" />
      </DialogBody>
      <DialogFooter>
        <button type="button">Confirm</button>
      </DialogFooter>
    </Dialog>
  );
  const { rerender } = render(view(open));
  return { onClose, setOpen: (isOpen: boolean) => rerender(view(isOpen)) };
}

describe("Dialog", () => {
  it("shows a modal named by its title, with its content, while open", () => {
    renderDialog(true);

    const dialog = screen.getByRole("dialog", { name: "Approve Acme?" });
    expect(dialog).toHaveTextContent("Body text");
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
  });

  it("shows nothing while closed, and does not render its content", () => {
    renderDialog(false);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Body text")).not.toBeInTheDocument();
  });

  it("opens and closes when `open` changes", () => {
    const { setOpen } = renderDialog(false);

    setOpen(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    setOpen(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("forgets what was typed once closed: the next opening starts empty", async () => {
    const { setOpen } = renderDialog(true);
    await userEvent.type(screen.getByLabelText("Reason"), "draft");

    setOpen(false);
    setOpen(true);

    expect(screen.getByLabelText("Reason")).toHaveValue("");
  });

  it("asks to close from the Close button", async () => {
    const { onClose } = renderDialog(true);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks to close when the dark backdrop is clicked, but not when the content is", async () => {
    const { onClose } = renderDialog(true);

    await userEvent.click(screen.getByText("Body text"));
    expect(onClose).not.toHaveBeenCalled();

    // The backdrop is the <dialog> element itself.
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("asks to close when the browser closes it (the Escape key)", () => {
    const { onClose } = renderDialog(true);

    fireEvent(screen.getByRole("dialog"), new Event("close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
