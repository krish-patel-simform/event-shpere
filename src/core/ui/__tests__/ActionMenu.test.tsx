/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionMenu, type ActionMenuItem } from "../ActionMenu";

function renderMenu(overrides: Partial<{ onSelect: () => void }> = {}) {
  const onSelect = overrides.onSelect ?? jest.fn();
  const items: ActionMenuItem[] = [
    { label: "View profile", href: "/admin/users/1" },
    { label: "Change role", onSelect },
    { label: "Suspend user", onSelect, tone: "danger", separatorBefore: true },
  ];
  render(
    <>
      <ActionMenu label="Actions for Rahul Sharma" items={items} />
      <button type="button">Elsewhere</button>
    </>,
  );
  return { onSelect };
}

const trigger = () =>
  screen.getByRole("button", { name: "Actions for Rahul Sharma" });

describe("ActionMenu", () => {
  it("is closed until the button is pressed, and says so to assistive tech", () => {
    renderMenu();

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a menu named like the button, with links and buttons as menu items", async () => {
    renderMenu();

    await userEvent.click(trigger());

    expect(
      screen.getByRole("menu", { name: "Actions for Rahul Sharma" }),
    ).toBeInTheDocument();
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(
      screen.getByRole("menuitem", { name: "View profile" }),
    ).toHaveAttribute("href", "/admin/users/1");
  });

  it("moves focus to the first item when it opens", async () => {
    renderMenu();

    await userEvent.click(trigger());

    expect(
      screen.getByRole("menuitem", { name: "View profile" }),
    ).toHaveFocus();
  });

  it("arrow keys move between items and wrap around; Home and End jump", async () => {
    renderMenu();
    await userEvent.click(trigger());

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Change role" })).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(
      screen.getByRole("menuitem", { name: "View profile" }),
    ).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}");
    expect(
      screen.getByRole("menuitem", { name: "Suspend user" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(
      screen.getByRole("menuitem", { name: "View profile" }),
    ).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(
      screen.getByRole("menuitem", { name: "Suspend user" }),
    ).toHaveFocus();
  });

  it("runs the chosen action and closes, returning focus to the button", async () => {
    const { onSelect } = renderMenu();
    await userEvent.click(trigger());

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Change role" }),
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("Escape closes it and returns focus to the button", async () => {
    renderMenu();
    await userEvent.click(trigger());

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("a click outside closes it", async () => {
    renderMenu();
    await userEvent.click(trigger());

    await userEvent.click(screen.getByRole("button", { name: "Elsewhere" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("pressing the button again closes it", async () => {
    renderMenu();
    await userEvent.click(trigger());

    await userEvent.click(trigger());

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("marks a destructive item in red", async () => {
    renderMenu();
    await userEvent.click(trigger());

    expect(screen.getByRole("menuitem", { name: "Suspend user" })).toHaveClass(
      "text-danger",
    );
    expect(
      screen.getByRole("menuitem", { name: "Change role" }),
    ).not.toHaveClass("text-danger");
  });
});
