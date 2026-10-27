/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { tabId, Tabs, type Tab } from "../Tabs";

type Key = "a" | "b" | "c";
const tabs: readonly Tab<Key>[] = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Beta", tone: "danger" },
  { key: "c", label: "Gamma" },
];

function renderTabs(
  value: Key = "a",
  counts: Partial<Record<Key, number>> = {},
) {
  const onChange = jest.fn();
  render(
    <Tabs
      label="Filter things"
      tabs={tabs}
      counts={counts}
      value={value}
      onChange={onChange}
      panelId="panel"
    />,
  );
  return onChange;
}

describe("Tabs", () => {
  it("is a tablist with one tab per entry; only the selected one is selected and in the Tab order", () => {
    renderTabs("b");

    expect(
      screen.getByRole("tablist", { name: "Filter things" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("points each tab at the panel, and names the panel by id", () => {
    renderTabs();

    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute(
      "aria-controls",
      "panel",
    );
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute(
      "id",
      tabId("panel", "a"),
    );
  });

  it("shows a count only on the tabs that have one", () => {
    renderTabs("a", { a: 1234, c: 0 });

    expect(
      within(screen.getByRole("tab", { name: /Alpha/ })).getByText("1,234"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("tab", { name: /Gamma/ })).getByText("0"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Beta" })).toHaveTextContent(
      /^Beta$/,
    );
  });

  it("clicking a tab selects it", async () => {
    const onChange = renderTabs();

    await userEvent.click(screen.getByRole("tab", { name: "Gamma" }));

    expect(onChange).toHaveBeenCalledWith("c");
  });

  it.each([
    ["{ArrowRight}", "a", "b"],
    ["{ArrowRight}", "c", "a"],
    ["{ArrowLeft}", "a", "c"],
    ["{ArrowLeft}", "b", "a"],
    ["{Home}", "c", "a"],
    ["{End}", "a", "c"],
  ] as const)("%s from %s selects %s", async (keys, from, to) => {
    const onChange = renderTabs(from);
    screen.getByRole("tab", { selected: true }).focus();

    await userEvent.keyboard(keys);

    expect(onChange).toHaveBeenCalledWith(to);
  });
});
