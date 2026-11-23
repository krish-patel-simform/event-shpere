/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Kpi } from "../Kpi";
import { SourceBadge } from "../SourceBadge";

describe("Kpi", () => {
  it("shows the label, the number with thousands separators, and the note", () => {
    render(<Kpi label="Registrations" value={12480} note="Across events" />);

    expect(screen.getByText("Registrations")).toBeInTheDocument();
    expect(screen.getByText("12,480")).toBeInTheDocument();
    expect(screen.getByText("Across events")).toBeInTheDocument();
  });

  it("shows — while the number is not known yet", () => {
    render(<Kpi label="Checked in" value={undefined} note="of 480" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows a 0 as 0, not as —", () => {
    render(<Kpi label="Cancelled" value={0} note="registrations" />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows text values as given, and a badge next to the label", () => {
    render(
      <Kpi
        label="Fill"
        value="44%"
        note="of seats"
        badge={<SourceBadge source="static" />}
      />,
    );

    expect(screen.getByText("44%")).toBeInTheDocument();
    expect(screen.getByText("Static")).toBeInTheDocument();
  });

  it("turns the figure amber with warn", () => {
    render(<Kpi label="Unscheduled" value={2} note="sessions" warn />);

    expect(screen.getByText("2")).toHaveClass("text-warning");
  });
});
