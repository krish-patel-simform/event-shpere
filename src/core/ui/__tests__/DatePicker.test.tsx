/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "../DatePicker";

function setup(props: Partial<React.ComponentProps<typeof DatePicker>> = {}) {
  const onChange = jest.fn();
  const onBlur = jest.fn();
  render(
    <DatePicker
      label="Start date"
      value=""
      onChange={onChange}
      onBlur={onBlur}
      {...props}
    />,
  );
  return { onChange, onBlur };
}

/** A day's button in the open calendar, by its day number as the library names it. */
function dayButton(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("DatePicker", () => {
  it("shows a placeholder while no day is chosen", () => {
    setup();

    expect(
      screen.getByRole("button", { name: /Start date/ }),
    ).toHaveTextContent("Select a date");
  });

  it("shows the chosen day, and says it in the button's name", () => {
    setup({ value: "2026-12-12" });

    const button = screen.getByRole("button", { name: /Start date/ });
    expect(button).toHaveTextContent("Sat, 12 Dec 2026");
    expect(button).toHaveAccessibleName("Start date Sat, 12 Dec 2026");
  });

  it("opens a calendar dialog from the button", async () => {
    const user = userEvent.setup();
    setup({ value: "2026-12-12" });

    await user.click(screen.getByRole("button", { name: /Start date/ }));

    expect(
      screen.getByRole("dialog", { name: "Choose start date" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start date/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("chooses a day, reports it as text, closes, and gives the focus back", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "2026-12-12" });
    const button = screen.getByRole("button", { name: /Start date/ });

    await user.click(button);
    await user.click(dayButton(/December 15th, 2026/));

    expect(onChange).toHaveBeenCalledWith("2026-12-15");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("disables the days before the first day that can be chosen", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "2026-11-10", min: "2026-11-06" });

    await user.click(screen.getByRole("button", { name: /Start date/ }));

    expect(dayButton(/November 5th, 2026/)).toBeDisabled();
    expect(dayButton(/November 6th, 2026/)).toBeEnabled();

    await user.click(dayButton(/November 5th, 2026/));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the days after the last day that can be chosen", async () => {
    const user = userEvent.setup();
    setup({ value: "2036-11-01", max: "2036-11-06" });

    await user.click(screen.getByRole("button", { name: /Start date/ }));

    expect(dayButton(/November 6th, 2036/)).toBeEnabled();
    expect(dayButton(/November 7th, 2036/)).toBeDisabled();
  });

  it("closes with Escape and keeps the focus on the button", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "2026-12-12" });

    await user.click(screen.getByRole("button", { name: /Start date/ }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start date/ })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes on a click outside it, and tells the form the field was left", async () => {
    const user = userEvent.setup();
    const { onBlur } = setup({ value: "2026-12-12" });

    await user.click(screen.getByRole("button", { name: /Start date/ }));
    await user.click(document.body);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onBlur).toHaveBeenCalled();
  });

  it("shows an error, tied to the button", () => {
    setup({ error: "Start date is required" });

    expect(screen.getByText("Start date is required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start date/ }),
    ).toHaveAccessibleDescription("Start date is required");
  });

  it("can not be opened while disabled", () => {
    setup({ disabled: true });

    expect(screen.getByRole("button", { name: /Start date/ })).toBeDisabled();
  });
});
