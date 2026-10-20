/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { OrganizerReviewStatus, type OrganizerApplication } from "../components/OrganizerReviewStatus";
import { formatDate } from "../utils/format-date";

const application: OrganizerApplication = {
  organisationName: "Acme Events Pvt Ltd",
  website: "https://acme-events.example.com",
  contactName: "Ananya Rao",
  contactEmail: "ananya.rao@example.com",
  submittedAt: "2026-10-20T11:24:00Z",
  emailVerifiedAt: "2026-10-20T11:30:00Z",
};

describe("formatDate", () => {
  it("prints the same text whatever the machine's time zone (UTC)", () => {
    expect(formatDate("2026-10-20T11:24:00Z")).toBe("20 Oct 2026");
    expect(formatDate("2026-10-20T11:24:00Z", "long")).toBe("20 October 2026, 11:24");
  });
});

describe("OrganizerReviewStatus", () => {
  it("says the request is under review", () => {
    render(<OrganizerReviewStatus application={application} />);
    expect(screen.getByRole("heading", { name: "Your organizer request is under review" })).toBeInTheDocument();
    expect(screen.getByText("Pending review")).toBeInTheDocument();
  });

  it("shows the four stages with admin review as the current one", () => {
    render(<OrganizerReviewStatus application={application} />);
    const items = screen.getAllByRole("listitem");

    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("Application submitted");
    expect(items[0]).toHaveTextContent("20 Oct 2026");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveTextContent("In progress");
    expect(items[3]).toHaveTextContent("After approval");
  });

  it("lists what was submitted", () => {
    render(<OrganizerReviewStatus application={application} />);
    expect(screen.getByText("Acme Events Pvt Ltd")).toBeInTheDocument();
    expect(screen.getByText("Ananya Rao · ananya.rao@example.com")).toBeInTheDocument();
    expect(screen.getByText("20 October 2026, 11:24")).toBeInTheDocument();
  });

  it("says so when no website was given", () => {
    render(<OrganizerReviewStatus application={{ ...application, website: null }} />);
    expect(screen.getByText("Not provided")).toBeInTheDocument();
  });

  it("offers attendee actions while waiting", () => {
    render(<OrganizerReviewStatus application={application} />);
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "/events");
    expect(screen.getByRole("link", { name: "Complete your profile" })).toHaveAttribute("href", "/profile");
  });
});
