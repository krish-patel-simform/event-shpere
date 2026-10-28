import { Avatar, Badge, Card } from "@/src/core/ui";
import {
  profileCompleteness,
  type ProfileFormValues,
} from "../utils/own-profile-form";
import { roleLine, speakerFullName } from "../utils/speaker-display";

const BIO_PREVIEW_LENGTH = 160;

/** The start of the bio, cut at a word and marked with an ellipsis when it is longer. */
function bioSnippet(bio: string): string {
  const text = bio.trim().replace(/\s+/g, " ");
  if (text.length <= BIO_PREVIEW_LENGTH) return text;
  return `${text.slice(0, BIO_PREVIEW_LENGTH).replace(/\s+\S*$/, "")}…`;
}

/**
 * A live look at the public profile card as the speaker types, and how complete the profile is.
 * It shows the form's values as they are, including ones not saved yet. Links are only counted,
 * never rendered as links: what is typed here is not checked until the form is sent.
 */
export function SpeakerProfilePreview({
  values,
}: {
  values: ProfileFormValues;
}) {
  const name = speakerFullName({
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
  }).trim();
  const role = roleLine({
    jobTitle: values.jobTitle.trim() || null,
    company: values.company.trim() || null,
  });
  const bio = bioSnippet(values.bio);
  const { percent, missing } = profileCompleteness(values);

  return (
    <div className="space-y-4">
      <Card title="Public preview" description="How attendees see you.">
        <div className="flex items-start gap-3">
          <Avatar name={name || "?"} className="size-12 text-base" />
          <div className="min-w-0">
            <p className="font-semibold">{name || "Your name"}</p>
            {role && <p className="text-sm text-muted">{role}</p>}
          </div>
        </div>
        {bio && <p className="mt-3 text-sm">{bio}</p>}
        {values.expertise.length > 0 && (
          <ul aria-label="Topics" className="mt-3 flex flex-wrap gap-1.5">
            {values.expertise.slice(0, 6).map((topic) => (
              <li key={topic}>
                <Badge tone="brand">{topic}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Profile completeness">
        <div className="flex items-baseline justify-between text-sm">
          <span>Completed</span>
          <strong>{percent}%</strong>
        </div>
        <div
          role="progressbar"
          aria-label="Profile completeness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-2 overflow-hidden rounded bg-surface-subtle"
        >
          <div
            className="h-full rounded bg-brand"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted">
          {missing.length === 0
            ? "Nothing left to add."
            : `Still to add: ${missing.join(", ")}.`}
        </p>
      </Card>
    </div>
  );
}
