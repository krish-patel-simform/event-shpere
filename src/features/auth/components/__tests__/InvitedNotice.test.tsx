/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ACCOUNT_SETUP_TOKEN_TTL_HOURS } from "../../constants";
import { InvitedNotice } from "../InvitedNotice";

describe("InvitedNotice", () => {
  it("is a section named by its heading, for invited organizers", () => {
    render(<InvitedNotice />);

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Invited by an administrator?",
    });
    expect(heading).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Invited by an administrator?" }),
    ).toBeInTheDocument();
  });

  it("tells them to use the set-password link and how long it is valid", () => {
    render(<InvitedNotice />);

    expect(screen.getByText("set-password link")).toBeVisible();
    expect(
      screen.getByText(
        new RegExp(
          `The link is valid for\\s+${ACCOUNT_SETUP_TOKEN_TTL_HOURS} hours`,
        ),
      ),
    ).toBeVisible();
  });
});
