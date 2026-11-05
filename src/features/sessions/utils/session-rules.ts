// The rules a session's own fields must satisfy together, as pure code: creating a session checks
// the body, editing one checks the saved session with the changes applied ("merged"). Both use
// this one function, so the two can never disagree.

export type SessionShape = {
  mode: "in_person" | "online" | "hybrid";
  hallId?: string | null;
  onlineUrl?: string | null;
  startAt?: Date | null;
  endAt?: Date | null;
};

export type SessionShapeIssue = {
  /** The field the message belongs to. */
  path: "hallId" | "onlineUrl" | "startAt" | "endAt";
  message: string;
};

/** What is wrong with these fields taken together; an empty list means they are fine. */
export function checkSessionShape(shape: SessionShape): SessionShapeIssue[] {
  const issues: SessionShapeIssue[] = [];
  const add = (path: SessionShapeIssue["path"], message: string) =>
    issues.push({ path, message });

  if (!shape.startAt) add("startAt", "Set the start time");
  if (!shape.endAt) add("endAt", "Set the end time");
  if (shape.startAt && shape.endAt && shape.endAt <= shape.startAt) {
    add("endAt", "End must be after the start");
  }

  const needsHall = shape.mode !== "online"; // in person and hybrid
  const needsLink = shape.mode !== "in_person"; // online and hybrid

  if (needsHall && !shape.hallId) add("hallId", "Choose a hall");
  if (!needsHall && shape.hallId)
    add("hallId", "An online session has no hall");
  if (needsLink && !shape.onlineUrl) add("onlineUrl", "Add the join link");
  if (!needsLink && shape.onlineUrl) {
    add("onlineUrl", "An in-person session has no join link");
  }

  return issues;
}
