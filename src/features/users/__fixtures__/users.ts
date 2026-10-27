import type { UserListItemDto } from "../schemas/users.schema";

// Rows as GET /api/admin/users returns them, for tests. Not used by the app.

type Details = Partial<
  Pick<UserListItemDto, "role" | "status" | "emailVerified">
>;

/** An active, verified attendee unless `details` say otherwise. */
function user(
  number: number,
  firstName: string,
  lastName: string,
  email: string,
  createdAt: string,
  details: Details = {},
): UserListItemDto {
  return {
    id: `6f1d2a40-1c1e-4b8e-9d55-2a8f0c3b7e${number}`,
    firstName,
    lastName,
    email,
    role: "user",
    status: "active",
    emailVerified: true,
    createdAt,
    updatedAt: createdAt,
    ...details,
  };
}

export const vikram = user(
  48,
  "Vikram",
  "Mehta",
  "vikram.mehta@example.com",
  "2026-10-21T09:00:00.000Z",
  { role: "speaker", status: "pending", emailVerified: false },
);
export const ananya = user(
  41,
  "Ananya",
  "Rao",
  "ananya.rao@example.com",
  "2026-10-20T09:15:00.000Z",
  { role: "organizer" },
);
export const fatima = user(
  46,
  "Fatima",
  "Sheikh",
  "fatima@example.com",
  "2026-10-17T09:00:00.000Z",
  { role: "organizer", status: "pending", emailVerified: false },
);
export const rahul = user(
  43,
  "Rahul",
  "Sharma",
  "rahul.sharma@example.com",
  "2026-10-11T08:00:00.000Z",
);
export const meera = user(
  45,
  "Meera",
  "Joshi",
  "meera.joshi@example.com",
  "2026-09-28T08:00:00.000Z",
  { role: "speaker" },
);
export const dev = user(
  47,
  "Dev",
  "Verma",
  "dev.v@example.com",
  "2026-08-09T08:00:00.000Z",
  { status: "suspended" },
);
export const kavya = user(
  42,
  "Kavya",
  "Menon",
  "kavya@example.com",
  "2026-03-02T10:00:00.000Z",
  { role: "organizer" },
);
export const admin = user(
  44,
  "Admin",
  "User",
  "admin@eventsphere.example",
  "2026-01-05T08:00:00.000Z",
  { role: "admin" },
);
/** An account with no role: broken data the page must survive. */
export const noRole = user(
  49,
  "Nora",
  "Norole",
  "nora@example.com",
  "2026-01-01T08:00:00.000Z",
  { role: null },
);

/** In the order the API returns them for the default sort: newest first. */
export const userRows: UserListItemDto[] = [
  vikram,
  ananya,
  fatima,
  rahul,
  meera,
  dev,
  kavya,
  admin,
];
