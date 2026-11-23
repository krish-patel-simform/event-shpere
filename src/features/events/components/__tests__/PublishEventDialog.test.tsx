/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError } from "@/src/core/api-client/base-api.service";
import { FINTECH_ID, SAMPLE_EVENTS } from "../../__fixtures__/event-manage";
import {
  chooseDate,
  chooseTime,
  findDayButton,
} from "../../__fixtures__/pickers";
import { toFormDateTime } from "../../utils/event-display";
import { PublishEventDialog } from "../PublishEventDialog";

// The dialog the overview opens before publishing: it asks when registration opens and closes.

const DAY = 86_400_000;
const IST = "Asia/Kolkata";

/** The IST calendar day `days` from now, as "2026-12-12". */
const dayKey = (days: number) =>
  toFormDateTime(new Date(Date.now() + days * DAY).toISOString(), IST).date;

const fintech = SAMPLE_EVENTS.find((event) => event.id === FINTECH_ID)!;
// A draft that starts in 30 days, so the dates the tests choose stay valid whenever they run.
const draft = {
  ...fintech,
  startAt: new Date(Date.now() + 30 * DAY).toISOString(),
  endAt: new Date(Date.now() + 31 * DAY).toISOString(),
  timezone: IST,
};

function renderDialog(
  props: Partial<React.ComponentProps<typeof PublishEventDialog>> = {},
) {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  render(
    <PublishEventDialog
      event={draft}
      onClose={onClose}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, onClose };
}

/** Opens today, closes the day before the event starts: valid whatever the date is. */
async function fillWindow() {
  await chooseDate("Registration start date", dayKey(0));
  await chooseTime("Registration start time", "10:00");
  await chooseDate("Registration end date", dayKey(29));
  await chooseTime("Registration end time", "10:00");
}

describe("PublishEventDialog", () => {
  it("is closed without an event", () => {
    renderDialog({ event: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks for the four dates and says when the event starts", () => {
    renderDialog();

    const dialog = within(
      screen.getByRole("dialog", { name: "Publish this event?" }),
    );
    expect(dialog.getByText(draft.title)).toBeInTheDocument();
    expect(dialog.getByText(/The event starts on/)).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: /^Registration start date/ }),
    ).toBeInTheDocument();
    expect(
      dialog.getByRole("combobox", { name: /^Registration start time/ }),
    ).toBeInTheDocument();
    expect(
      dialog.getByRole("button", { name: /^Registration end date/ }),
    ).toBeInTheDocument();
    expect(
      dialog.getByRole("combobox", { name: /^Registration end time/ }),
    ).toBeInTheDocument();
  });

  it("starts with nothing chosen, so the organizer has to decide", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Publish event" }));

    expect(
      await screen.findByText("Registration start date is required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Registration start time is required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Registration end date is required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Registration end time is required"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends both dates as ISO strings in India's offset once they are chosen", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await fillWindow();
    await user.click(screen.getByRole("button", { name: "Publish event" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      registrationOpensAt: `${dayKey(0)}T10:00:00+05:30`,
      registrationClosesAt: `${dayKey(29)}T10:00:00+05:30`,
    });
  });

  it("does not offer a closing day after the event starts", async () => {
    renderDialog();

    const afterStart = await findDayButton("Registration end date", dayKey(31));

    expect(afterStart).toBeDisabled();
  });

  it("shows the server's refusal of one date under that date, not in the box on top", () => {
    renderDialog({
      error: new ApiError(400, "VALIDATION_ERROR", "Invalid request", {
        registrationClosesAt: ["Registration must end in the future"],
      }),
    });

    expect(
      screen.getByText("Registration must end in the future"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows any other refusal in the box on top and keeps the dialog open", () => {
    renderDialog({
      error: new ApiError(409, "EVENT_NOT_READY", "Missing: content"),
    });

    const alert = within(screen.getByRole("alert"));
    expect(
      alert.getByText("We couldn't publish the event"),
    ).toBeInTheDocument();
    expect(alert.getByText("Missing: content")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows that it is publishing and cannot be cancelled meanwhile", () => {
    renderDialog({ isPending: true });

    expect(
      screen.getByRole("button", { name: "Publishing…" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("closes without publishing on Cancel", async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
