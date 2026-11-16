/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { TimePicker } from "../TimePicker";

function setup(props: Partial<ComponentProps<typeof TimePicker>> = {}) {
  const onChange = jest.fn();
  const onBlur = jest.fn();
  render(
    <TimePicker
      label="Start time"
      value=""
      onChange={onChange}
      onBlur={onBlur}
      {...props}
    />,
  );
  return { onChange, onBlur };
}

const field = () => screen.getByRole("combobox", { name: /Start time/ });

describe("TimePicker", () => {
  it("shows a placeholder while no time is chosen", () => {
    setup();

    expect(field()).toHaveTextContent("Select a time");
  });

  it("shows the chosen time as AM/PM, and says it in the field's name", () => {
    setup({ value: "17:45" });

    expect(field()).toHaveTextContent("5:45 PM");
    expect(field()).toHaveAccessibleName("Start time 5:45 PM");
  });

  it("lists every 15 minutes of the day", async () => {
    const user = userEvent.setup();
    setup();

    await user.click(field());

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(96);
    expect(options[0]).toHaveTextContent("12:00 AM");
    expect(options[1]).toHaveTextContent("12:15 AM");
    expect(options[95]).toHaveTextContent("11:45 PM");
  });

  it("chooses a time with the mouse, reports it as 24-hour text, and closes", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(field());
    await user.click(screen.getByRole("option", { name: "2:30 PM" }));

    expect(onChange).toHaveBeenCalledWith("14:30");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it("disables the times before the earliest one, and they can not be chosen", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ min: "10:30" });

    await user.click(field());

    expect(screen.getByRole("option", { name: "10:15 AM" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByRole("option", { name: "10:30 AM" }),
    ).not.toHaveAttribute("aria-disabled");

    await user.click(screen.getByRole("option", { name: "10:15 AM" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("starts on 09:00 when nothing is chosen, and moves with the arrow keys", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(field());
    expect(field()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: "9:00 AM" }).id,
    );

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("09:30");
  });

  it("skips disabled times with the arrow keys", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ min: "10:00" });

    // 09:00 is disabled, so it starts on the first usable time, 10:00.
    await user.click(field());
    await user.keyboard("{ArrowUp}{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith("10:00");
  });

  it("jumps to the first and the last usable time with Home and End", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ min: "10:00" });

    await user.click(field());
    await user.keyboard("{End}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("23:45");

    await user.keyboard("{Enter}{Home}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("10:00");
  });

  it("opens from the keyboard", async () => {
    const user = userEvent.setup();
    setup();

    field().focus();
    await user.keyboard("{ArrowDown}");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes with Escape without choosing anything", async () => {
    const user = userEvent.setup();
    const { onChange } = setup();

    await user.click(field());
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("closes when the focus leaves, and tells the form", async () => {
    const user = userEvent.setup();
    const { onBlur } = setup();

    await user.click(field());
    await user.tab();

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onBlur).toHaveBeenCalled();
  });

  it("says so when no time can be chosen", async () => {
    const user = userEvent.setup();
    setup({ min: null });

    expect(screen.getByText("No time can be chosen.")).toBeInTheDocument();

    await user.click(field());
    expect(
      screen
        .getAllByRole("option")
        .every((option) => option.getAttribute("aria-disabled") === "true"),
    ).toBe(true);
  });

  it("shows an error, tied to the field", () => {
    setup({ error: "Start time is required" });

    expect(field()).toHaveAccessibleDescription("Start time is required");
  });
});
