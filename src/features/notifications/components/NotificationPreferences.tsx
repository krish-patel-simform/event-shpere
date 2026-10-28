import { Alert, Button, Card } from "@/src/core/ui";
import type { NotificationPreference } from "../types/notification";

/**
 * The delivery preferences (email, push) from the design. The API to save them does not exist
 * yet, so the card says so and its boxes and button are disabled: nothing here can be changed
 * and then silently lost.
 */
export function NotificationPreferences({
  preferences,
}: {
  preferences: readonly NotificationPreference[];
}) {
  return (
    <Card
      title="Delivery preferences"
      description="In-app notifications are always on."
    >
      <div className="space-y-4">
        <Alert tone="info" title="Not available yet">
          Saving delivery preferences is not built yet. These are the planned
          choices.
        </Alert>
        <div>
          {preferences.map((preference) => (
            <fieldset
              key={preference.id}
              disabled
              className="border-b border-line py-3 last:border-b-0"
            >
              <legend className="float-left w-full font-semibold">
                {preference.label}
              </legend>
              {preference.description && (
                <p className="clear-both text-sm text-muted">
                  {preference.description}
                </p>
              )}
              <div className="clear-both mt-1.5 flex gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={preference.email}
                    className="size-4"
                  />
                  Email
                </label>
                {preference.push !== null && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      defaultChecked={preference.push}
                      className="size-4"
                    />
                    Push
                  </label>
                )}
              </div>
            </fieldset>
          ))}
        </div>
        <Button disabled fullWidth>
          Save preferences
        </Button>
      </div>
    </Card>
  );
}
