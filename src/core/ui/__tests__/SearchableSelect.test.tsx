/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import {
  filterOptions,
  SearchableSelect,
  type SelectOption,
} from "../SearchableSelect";

const options: SelectOption[] = [
  { value: "gj", label: "Gujarat", hint: "GJ" },
  { value: "ga", label: "Goa", hint: "GA" },
  { value: "mh", label: "Maharashtra", hint: "MH" },
  { value: "ka", label: "Karnataka", hint: "KA" },
];

type Props = Partial<ComponentProps<typeof SearchableSelect>> & {
  initial?: string;
  onChangeSpy?: (value: string) => void;
};

/** Holds the value like a form would, so a choice shows up in the field. */
function Harness({ initial = "", onChangeSpy, ...rest }: Props) {
  const [value, setValue] = useState(initial);
  return (
    <SearchableSelect
      label="State"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChangeSpy?.(next);
      }}
      {...rest}
    />
  );
}

const field = () => screen.getByRole("combobox", { name: "State" });
const optionNames = () =>
  screen.getAllByRole("option").map((option) => option.textContent);

describe("filterOptions", () => {
  it("returns every option for an empty or blank search", () => {
    expect(filterOptions(options, "")).toEqual(options);
    expect(filterOptions(options, "   ")).toEqual(options);
  });

  it("matches the label anywhere in it, ignoring case and surrounding spaces", () => {
    expect(filterOptions(options, "  RASH ").map((o) => o.label)).toEqual([
      "Maharashtra",
    ]);
  });

  it("also matches the hint (a code)", () => {
    expect(filterOptions(options, "ka").map((o) => o.label)).toEqual([
      "Karnataka",
    ]);
  });

  it("puts labels that start with the text before the others", () => {
    // "New Delhi" is listed first but only contains "del"; "Delhi" starts with it.
    const cities: SelectOption[] = [
      { value: "1", label: "New Delhi" },
      { value: "2", label: "Delhi" },
      { value: "3", label: "Old Delhi" },
    ];

    expect(filterOptions(cities, "del").map((o) => o.label)).toEqual([
      "Delhi",
      "New Delhi",
      "Old Delhi",
    ]);
  });

  it("is empty when nothing matches", () => {
    expect(filterOptions(options, "zzz")).toEqual([]);
  });

  it("does not change the list it was given", () => {
    const before = options.map((o) => o.label);
    filterOptions(options, "g");
    expect(options.map((o) => o.label)).toEqual(before);
  });
});

describe("SearchableSelect: opening and choosing", () => {
  it("starts closed, showing the placeholder", () => {
    render(<Harness placeholder="Choose a state" />);

    expect(field()).toHaveAttribute("aria-expanded", "false");
    expect(field()).toHaveAttribute("placeholder", "Choose a state");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens with every option when clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());

    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox", { name: "State" })).toBeInTheDocument();
    expect(optionNames()).toEqual([
      "GujaratGJ",
      "GoaGA",
      "MaharashtraMH",
      "KarnatakaKA",
    ]);
  });

  it("chooses an option by click: shows its label, closes, and reports its value", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    await user.click(field());
    await user.click(screen.getByRole("option", { name: /^Goa/ }));

    expect(onChangeSpy).toHaveBeenCalledWith("ga");
    expect(field()).toHaveValue("Goa");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("marks the chosen option as selected when the list is opened again", async () => {
    const user = userEvent.setup();
    render(<Harness initial="mh" />);

    expect(field()).toHaveValue("Maharashtra");
    await user.click(field());

    expect(
      screen.getByRole("option", { name: /^Maharashtra/ }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /^Goa/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("does not open when disabled", async () => {
    const user = userEvent.setup();
    render(<Harness disabled />);

    await user.click(field());

    expect(field()).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes when the field loses focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button type="button">elsewhere</button>
      </>,
    );

    await user.click(field());
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("calls onBlur when the field loses focus", async () => {
    const user = userEvent.setup();
    const onBlur = jest.fn();
    render(
      <>
        <Harness onBlur={onBlur} />
        <button type="button">elsewhere</button>
      </>,
    );

    await user.click(field());
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("SearchableSelect: searching", () => {
  it("narrows the list as you type, by name", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.type(field(), "go");

    expect(optionNames()).toEqual(["GoaGA"]);
  });

  it("also finds an option by its hint", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.type(field(), "mh");

    expect(optionNames()).toEqual(["MaharashtraMH"]);
  });

  it("says nothing matches", async () => {
    const user = userEvent.setup();
    render(<Harness noMatchMessage="No state matches your search" />);

    await user.click(field());
    await user.type(field(), "zzz");

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(
      screen.getByText("No state matches your search"),
    ).toBeInTheDocument();
  });

  it("says there is nothing to choose from when there are no options at all", async () => {
    const user = userEvent.setup();
    render(<Harness options={[]} emptyMessage="No active venues here yet." />);

    await user.click(field());

    expect(screen.getByText("No active venues here yet.")).toBeInTheDocument();
  });

  it("tells screen readers how many results there are", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    expect(screen.getByRole("status")).toHaveTextContent("4 results");
    await user.type(field(), "goa");

    expect(screen.getByRole("status")).toHaveTextContent("1 result");
  });

  it("shows what you type while open, and the chosen label again when closed", async () => {
    const user = userEvent.setup();
    render(<Harness initial="gj" />);

    await user.click(field());
    await user.type(field(), "goa");
    expect(field()).toHaveValue("goa");

    await user.keyboard("{Escape}");
    expect(field()).toHaveValue("Gujarat");
  });
});

describe("SearchableSelect: keyboard", () => {
  const activeLabel = () => {
    const id = field().getAttribute("aria-activedescendant");
    return id ? document.getElementById(id)?.textContent : null;
  };

  it("opens with the arrow keys and moves through the options", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    field().focus();
    await user.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(activeLabel()).toBe("GujaratGJ");

    await user.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("GoaGA");
    await user.keyboard("{ArrowUp}");
    expect(activeLabel()).toBe("GujaratGJ");
  });

  it("stops at the first and last option", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(activeLabel()).toBe("GujaratGJ");
    await user.keyboard(
      "{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}",
    );
    expect(activeLabel()).toBe("KarnatakaKA");
  });

  it("chooses the highlighted option with Enter", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    await user.click(field());
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onChangeSpy).toHaveBeenCalledWith("ga");
    expect(field()).toHaveValue("Goa");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("chooses the first match after typing, with Enter", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness onChangeSpy={onChangeSpy} />);

    await user.click(field());
    await user.type(field(), "kar{Enter}");

    expect(onChangeSpy).toHaveBeenCalledWith("ka");
  });

  it("Enter picks a row and does not submit the form around it", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );

    await user.click(field());
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(field()).toHaveValue("Gujarat");
  });

  it("Escape closes the list and keeps the old choice", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(<Harness initial="mh" onChangeSpy={onChangeSpy} />);

    await user.click(field());
    await user.keyboard("{ArrowDown}{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChangeSpy).not.toHaveBeenCalled();
    expect(field()).toHaveValue("Maharashtra");
  });

  it("starts the arrow keys on the chosen option", async () => {
    const user = userEvent.setup();
    render(<Harness initial="mh" />);

    await user.click(field());

    expect(activeLabel()).toBe("MaharashtraMH");
  });
});

describe("SearchableSelect: the clear option", () => {
  it("is the first row, and choosing it clears the value", async () => {
    const user = userEvent.setup();
    const onChangeSpy = jest.fn();
    render(
      <Harness
        initial="gj"
        emptyOption="Choose later"
        onChangeSpy={onChangeSpy}
      />,
    );

    await user.click(field());
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Choose later");
    await user.click(screen.getByRole("option", { name: "Choose later" }));

    expect(onChangeSpy).toHaveBeenCalledWith("");
    expect(field()).toHaveValue("");
  });

  it("is left out while searching, so only real matches show", async () => {
    const user = userEvent.setup();
    render(<Harness emptyOption="Choose later" />);

    await user.click(field());
    await user.type(field(), "goa");

    expect(
      screen.queryByRole("option", { name: "Choose later" }),
    ).not.toBeInTheDocument();
  });

  it("is selected when nothing is chosen", async () => {
    const user = userEvent.setup();
    render(<Harness emptyOption="Choose later" />);

    await user.click(field());

    expect(
      screen.getByRole("option", { name: "Choose later" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("still shows the no-options message when the only row is the clear option", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        options={[]}
        emptyOption="Choose later"
        emptyMessage="No active venues here yet."
      />,
    );

    await user.click(field());

    expect(screen.getByText("No active venues here yet.")).toBeInTheDocument();
  });
});

describe("SearchableSelect: help and errors", () => {
  it("shows a hint, and points the field at it", () => {
    render(<Harness hint="Pick one" />);

    expect(screen.getByText("Pick one")).toBeInTheDocument();
    expect(field()).toHaveAccessibleDescription("Pick one");
  });

  it("shows an error, marks the field invalid and describes it", () => {
    render(<Harness error="Select a state" />);

    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field()).toHaveAccessibleDescription("Select a state");
  });

  it("has no invalid mark without an error", () => {
    render(<Harness />);

    expect(field()).not.toHaveAttribute("aria-invalid");
  });
});
