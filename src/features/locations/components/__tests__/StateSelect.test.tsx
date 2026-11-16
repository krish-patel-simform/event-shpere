/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { StateDto } from "../../schemas/state.schemas";
import { StateSelect } from "../StateSelect";

const states: StateDto[] = [
  { id: "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", name: "Goa", code: "IN-GA" },
  {
    id: "3b7c2d1e-6f5a-4e8d-9a0b-1c2d3e4f5a6b",
    name: "Gujarat",
    code: "IN-GJ",
  },
  {
    id: "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e06",
    name: "Maharashtra",
    code: "IN-MH",
  },
];

function Harness(props: Partial<Parameters<typeof StateSelect>[0]>) {
  const [value, setValue] = useState("");
  return (
    <StateSelect states={states} value={value} onChange={setValue} {...props} />
  );
}

const field = () => screen.getByRole("combobox", { name: "State" });

describe("StateSelect", () => {
  it("lists the states by name, each with its short code", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "GoaGA",
      "GujaratGJ",
      "MaharashtraMH",
    ]);
  });

  it("searches by name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.type(field(), "mahar");

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "MaharashtraMH",
    ]);
  });

  it("searches by code too: gj finds Gujarat", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.type(field(), "gj");

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "GujaratGJ",
    ]);
  });

  it("says no state matches", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.type(field(), "atlantis");

    expect(
      screen.getByText("No state matches your search"),
    ).toBeInTheDocument();
  });

  it("hands over the state's name, not its id", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<Harness onChange={onChange} />);

    await user.click(field());
    await user.click(screen.getByRole("option", { name: /^Gujarat/ }));

    expect(onChange).toHaveBeenCalledWith("Gujarat");
  });

  it("shows the chosen state", () => {
    render(<Harness value="Goa" />);

    expect(field()).toHaveValue("Goa");
  });

  it("is disabled and says so while the states load", () => {
    render(<Harness states={undefined} isLoading />);

    expect(field()).toBeDisabled();
    expect(field()).toHaveAttribute("placeholder", "Loading states…");
  });

  it("says when the states could not be loaded, with a way to try again", async () => {
    const user = userEvent.setup();
    const onRetry = jest.fn();
    render(<Harness states={undefined} loadFailed onRetry={onRetry} />);

    expect(screen.getByText(/Could not load the states/)).toBeVisible();
    expect(field()).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has no Try again button without a retry handler", () => {
    render(<Harness states={undefined} loadFailed />);

    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("shows a form error, which wins over the load error", () => {
    render(<Harness states={undefined} loadFailed error="Select a state" />);

    expect(screen.getByText("Select a state")).toBeInTheDocument();
    expect(
      screen.queryByText(/Could not load the states/),
    ).not.toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-invalid", "true");
  });

  it("can be disabled by the form, e.g. while saving", () => {
    render(<Harness disabled />);

    expect(field()).toBeDisabled();
  });

  it("can have another label", () => {
    render(<Harness label="Venue state" />);

    expect(
      screen.getByRole("combobox", { name: "Venue state" }),
    ).toBeInTheDocument();
  });
});
