/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import { Breadcrumb } from "../Breadcrumb";
import { Card } from "../Card";
import { DescriptionList } from "../DescriptionList";
import { Timeline } from "../Timeline";

describe("Card", () => {
  it("is a region named by its title, with the description and the action next to it", () => {
    render(
      <Card
        title="Organisation"
        description="Where they work"
        action={<a href="/x">Open</a>}
      >
        <p>Body</p>
      </Card>,
    );

    const region = screen.getByRole("region", { name: "Organisation" });
    expect(within(region).getByText("Where they work")).toBeInTheDocument();
    expect(
      within(region).getByRole("link", { name: "Open" }),
    ).toBeInTheDocument();
    expect(within(region).getByText("Body")).toBeInTheDocument();
  });

  it("without a title it is a plain box (no region, no heading)", () => {
    render(
      <Card>
        <p>Only content</p>
      </Card>,
    );

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Only content")).toBeInTheDocument();
  });
});

describe("DescriptionList", () => {
  it("pairs each label with its value, so a screen reader reads them together", () => {
    render(
      <DescriptionList
        items={[
          { label: "Email", value: "a@b.com" },
          { label: "Account", value: <strong>Active</strong> },
        ]}
      />,
    );

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual(
      ["Email", "Account"],
    );
    expect(
      screen.getAllByRole("definition").map((value) => value.textContent),
    ).toEqual(["a@b.com", "Active"]);
  });
});

describe("Timeline", () => {
  const items = [
    { title: "Approved", detail: "26 Oct 2026", done: true },
    { title: "Waiting" },
  ];

  it("is an ordered list of steps, each with its detail when it has one", () => {
    render(<Timeline items={items} />);

    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(2);
    expect(steps[0]).toHaveTextContent("Approved");
    expect(steps[0]).toHaveTextContent("26 Oct 2026");
    expect(steps[1]).toHaveTextContent("Waiting");
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("makes the titles semibold only when asked", () => {
    const { rerender } = render(<Timeline items={items} />);
    expect(screen.getByText("Approved")).not.toHaveClass("font-semibold");

    rerender(<Timeline items={items} strongTitles />);
    expect(screen.getByText("Approved")).toHaveClass("font-semibold");
  });
});

describe("Breadcrumb", () => {
  it("links every step but the last, which marks the current page", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Users", href: "/admin/users" },
          { label: "Ananya Rao" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      "/admin/users",
    );
    expect(within(nav).getByText("Ananya Rao")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).queryByRole("link", { name: "Ananya Rao" }),
    ).not.toBeInTheDocument();
  });

  it("a step without a link is plain text", () => {
    render(<Breadcrumb items={[{ label: "Admin" }, { label: "Users" }]} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
