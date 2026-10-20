/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Ticket } from "lucide-react";
import { AccountTypeCard } from "../components/AccountTypeCard";

describe("AccountTypeCard", () => {
  it("is one link named by its title and described by its text", () => {
    render(
      <AccountTypeCard
        href="/signup/user"
        icon={Ticket}
        title="I'm attending events"
        description="Discover events."
        features={[{ label: "Free account", icon: "check" }]}
      />,
    );

    const link = screen.getByRole("link", { name: "I'm attending events" });
    expect(link).toHaveAttribute("href", "/signup/user");
    expect(link).toHaveAccessibleDescription("Discover events.");
    expect(screen.getByText("Free account")).toBeInTheDocument();
  });
});
