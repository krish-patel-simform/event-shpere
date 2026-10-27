/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createPortal } from "react-dom";
import { ClickableRow } from "../ClickableRow";

/** The row's own link is a plain anchor here; a click that reaches it is "opening the page". */
function renderRow(extra?: React.ReactNode) {
  const opened = jest.fn((event: Event) => event.preventDefault());
  render(
    <table>
      <tbody>
        <ClickableRow>
          <td>
            <a
              href="/detail/1"
              data-row-link
              onClick={(e) => opened(e.nativeEvent)}
            >
              Ananya Rao
            </a>
            <span>ananya@example.com</span>
          </td>
          <td>
            <button type="button">Reject</button>
            {extra}
          </td>
        </ClickableRow>
      </tbody>
    </table>,
  );
  return opened;
}

describe("ClickableRow", () => {
  it("opens the row's link when you click anywhere else on the row", async () => {
    const opened = renderRow();

    await userEvent.click(screen.getByText("ananya@example.com"));

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("opens it when you click an empty part of the row itself", async () => {
    const opened = renderRow();

    await userEvent.click(screen.getAllByRole("cell")[0]);

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("clicking the link itself opens it once, not twice", async () => {
    const opened = renderRow();

    await userEvent.click(screen.getByRole("link", { name: "Ananya Rao" }));

    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("leaves a button in the row to do its own job", async () => {
    const opened = renderRow();
    const onReject = jest.fn();
    screen.getByRole("button", { name: "Reject" }).onclick = onReject;

    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(opened).not.toHaveBeenCalled();
  });

  it("ignores a click that bubbles up from a portal outside the row", () => {
    const opened = renderRow(
      createPortal(
        <div role="menu">
          <span>Suspend user</span>
        </div>,
        document.body,
      ),
    );

    fireEvent.click(screen.getByText("Suspend user"));

    expect(opened).not.toHaveBeenCalled();
  });

  it("does not open the row while the user is selecting text", async () => {
    const opened = renderRow();
    jest.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "ananya",
    } as Selection);

    await userEvent.click(screen.getByText("ananya@example.com"));

    expect(opened).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("still calls the row's own onClick", async () => {
    const onClick = jest.fn();
    render(
      <table>
        <tbody>
          <ClickableRow onClick={onClick}>
            <td>cell</td>
          </ClickableRow>
        </tbody>
      </table>,
    );

    await userEvent.click(screen.getByText("cell"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the row has no link", async () => {
    render(
      <table>
        <tbody>
          <ClickableRow>
            <td>cell</td>
          </ClickableRow>
        </tbody>
      </table>,
    );

    await expect(
      userEvent.click(screen.getByText("cell")),
    ).resolves.toBeUndefined();
  });
});
