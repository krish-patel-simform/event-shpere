/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useHasPermission } from "@/src/features/auth";
import { TEST_PROFILE, VALID_PASSWORD } from "../../__fixtures__/profile";
import { PROFILE_SAMPLE } from "../../utils/profile.sample";
import { ProfileSettings } from "../ProfileSettings";

// Only the permission hook is replaced: the schemas, forms and cards are the real ones.
jest.mock("@/src/features/auth", () => ({
  ...jest.requireActual("@/src/features/auth"),
  useHasPermission: jest.fn(),
}));
const hasPermission = jest.mocked(useHasPermission);

const SAVED_NOTE = "Saved (sample data, not sent to the server yet)";
const fetchMock = jest.fn();

/** The permissions of the signed-in person, whatever role they have. */
function grant(...codes: string[]) {
  hasPermission.mockImplementation((code) => codes.includes(code));
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  grant("PROFILE_VIEW", "PROFILE_MANAGE", "NOTIFICATION_MANAGE");
});

describe("sections", () => {
  it("shows the sample person with one role badge and a read-only email", () => {
    render(<ProfileSettings />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Profile & settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue(
      PROFILE_SAMPLE.firstName,
    );
    expect(screen.getByRole("textbox", { name: "Last name" })).toHaveValue(
      PROFILE_SAMPLE.lastName,
    );
    const email = screen.getByRole("textbox", { name: "Email address" });
    expect(email).toHaveValue(PROFILE_SAMPLE.email);
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getAllByText("Speaker")).toHaveLength(1);

    for (const name of [
      "Profile",
      "Change password",
      "Appearance",
      "Email notifications",
      "Not available yet",
    ]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
  });

  it("uses the person it is given", () => {
    render(<ProfileSettings profile={TEST_PROFILE} />);

    expect(screen.getByRole("textbox", { name: "First name" })).toHaveValue(
      "Meera",
    );
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveValue(
      TEST_PROFILE.email,
    );
    expect(screen.getByText("Organizer")).toBeInTheDocument();
  });

  it("lists what is not available yet instead of faking it", () => {
    render(<ProfileSettings />);

    const card = screen.getByRole("region", { name: "Not available yet" });
    for (const label of [
      "Profile photo upload",
      "Two-step verification",
      "Where you are signed in",
      "Delete account",
    ]) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
    expect(
      within(card).getAllByText("Not available yet").length,
    ).toBeGreaterThan(3);
    expect(
      screen.getByText(/Photo upload is not available yet/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the email topics as disabled switches", () => {
    render(<ProfileSettings />);

    const card = screen.getByRole("region", { name: "Email notifications" });
    const boxes = within(card).getAllByRole("checkbox");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box).toBeDisabled();
    expect(within(card).getByText("Session reminders")).toBeInTheDocument();
    expect(within(card).getByText("Not available yet")).toBeInTheDocument();
  });
});

describe("what depends on permissions", () => {
  it("shows the platform topics to someone who reviews organizers", () => {
    grant(
      "PROFILE_VIEW",
      "PROFILE_MANAGE",
      "NOTIFICATION_MANAGE",
      "ORGANIZER_VERIFY",
    );
    render(<ProfileSettings />);

    expect(screen.getByText("A new organizer applies")).toBeInTheDocument();
    expect(screen.queryByText("Session reminders")).not.toBeInTheDocument();
  });

  it("hides the email card without NOTIFICATION_MANAGE", () => {
    grant("PROFILE_VIEW", "PROFILE_MANAGE");
    render(<ProfileSettings />);

    expect(
      screen.queryByRole("region", { name: "Email notifications" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Email notifications" }),
    ).not.toBeInTheDocument();
  });

  it("makes the forms read-only without PROFILE_MANAGE", () => {
    grant("PROFILE_VIEW");
    render(<ProfileSettings />);

    expect(screen.getByRole("textbox", { name: "First name" })).toHaveAttribute(
      "readonly",
    );
    expect(
      screen.queryByRole("button", { name: "Save profile" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Update password" }),
    ).not.toBeInTheDocument();
  });
});

describe("profile form", () => {
  it("asks for both names", async () => {
    const user = userEvent.setup();
    const onSaveProfile = jest.fn();
    render(<ProfileSettings onSaveProfile={onSaveProfile} />);

    await user.clear(screen.getByRole("textbox", { name: "First name" }));
    await user.clear(screen.getByRole("textbox", { name: "Last name" }));
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText("First name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "First name" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSaveProfile).not.toHaveBeenCalled();
    expect(screen.queryByText(SAVED_NOTE)).not.toBeInTheDocument();
  });

  it("shows the sample note after a valid save and sends nothing", async () => {
    const user = userEvent.setup();
    render(<ProfileSettings />);

    const first = screen.getByRole("textbox", { name: "First name" });
    await user.clear(first);
    await user.type(first, "  Anaya ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText(SAVED_NOTE)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hands the trimmed values to onSaveProfile", async () => {
    const user = userEvent.setup();
    const onSaveProfile = jest.fn();
    render(<ProfileSettings onSaveProfile={onSaveProfile} />);

    const first = screen.getByRole("textbox", { name: "First name" });
    await user.clear(first);
    await user.type(first, "  Anaya ");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() =>
      expect(onSaveProfile).toHaveBeenCalledWith({
        firstName: "Anaya",
        lastName: PROFILE_SAMPLE.lastName,
      }),
    );
  });

  it("shows an error and no note when saving fails", async () => {
    const user = userEvent.setup();
    const onSaveProfile = jest.fn().mockRejectedValue(new Error("boom"));
    render(<ProfileSettings onSaveProfile={onSaveProfile} />);

    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText("We couldn't save your profile"),
    ).toBeInTheDocument();
    expect(screen.queryByText(SAVED_NOTE)).not.toBeInTheDocument();
  });
});

describe("change password form", () => {
  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    values: { current?: string; next?: string; confirm?: string },
  ) {
    if (values.current)
      await user.type(
        screen.getByLabelText("Current password"),
        values.current,
      );
    if (values.next)
      await user.type(screen.getByLabelText("New password"), values.next);
    if (values.confirm)
      await user.type(
        screen.getByLabelText("Confirm new password"),
        values.confirm,
      );
    await user.click(screen.getByRole("button", { name: "Update password" }));
  }

  it("asks for the current password and the confirmation", async () => {
    const user = userEvent.setup();
    render(<ProfileSettings />);

    await fill(user, { next: VALID_PASSWORD });

    expect(
      await screen.findByText("Enter your current password"),
    ).toBeInTheDocument();
    expect(screen.getByText("Confirm your new password")).toBeInTheDocument();
    expect(screen.queryByText(SAVED_NOTE)).not.toBeInTheDocument();
  });

  it("applies the password rules", async () => {
    const user = userEvent.setup();
    render(<ProfileSettings />);

    await fill(user, {
      current: "Old!Passw0rd",
      next: "weak",
      confirm: "weak",
    });

    expect(
      await screen.findByText(/Password must be at least 8 characters/),
    ).toBeInTheDocument();
    expect(screen.queryByText(SAVED_NOTE)).not.toBeInTheDocument();
  });

  it("says when the confirmation does not match", async () => {
    const user = userEvent.setup();
    render(<ProfileSettings />);

    await fill(user, {
      current: "Old!Passw0rd",
      next: VALID_PASSWORD,
      confirm: "Different!Passw0rd1",
    });

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
  });

  it("shows the sample note, empties the fields and sends nothing", async () => {
    const user = userEvent.setup();
    render(<ProfileSettings />);

    await fill(user, {
      current: "Old!Passw0rd",
      next: VALID_PASSWORD,
      confirm: VALID_PASSWORD,
    });

    expect(await screen.findByText(SAVED_NOTE)).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can show a password with the Show button", async () => {
    const user = userEvent.setup();
    render(<ProfileSettings />);

    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "password",
    );
    const [, showNew] = screen.getAllByRole("button", {
      name: "Show password",
    });
    await user.click(showNew);
    expect(screen.getByLabelText("New password")).toHaveAttribute(
      "type",
      "text",
    );
  });
});
