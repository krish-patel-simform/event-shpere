// Sample data for the organizer's Schedule board, Speakers, Halls and Attendees tabs, until their
// APIs exist. Every screen that reads from here shows a Static badge. The shape follows what the
// API will answer, so swapping it for a hook later only changes where the rows come from.

export type SampleSessionType = "talk" | "workshop" | "panel" | "keynote";

export type SampleHall = {
  id: string;
  name: string;
  seats: number;
  isActive: boolean;
};

export type SampleSpeaker = {
  id: string;
  name: string;
  /** "Job title, Company". */
  headline: string;
  /** What is missing from the content written for the public page; `complete` = nothing. */
  profile: "complete" | "missing_photo" | "missing_bio";
};

export type SampleSession = {
  id: string;
  title: string;
  type: SampleSessionType;
  /** The hall; null = not placed yet. */
  hallId: string | null;
  /** 0 = the event's first day; null = not placed yet. */
  day: number | null;
  /** Minutes since midnight in the event's zone (9:30 = 570); null = not placed yet. */
  startMinute: number | null;
  endMinute: number | null;
  speakerIds: readonly string[];
  /** Paise on top of the event ticket; 0 = included. */
  price: number;
  cancelled: boolean;
  /** Seats booked, for a session that needs a booking. */
  booked: number | null;
};

export type SampleAttendee = {
  id: string;
  name: string;
  email: string;
  /** ISO date the person registered. */
  registeredAt: string;
  status: "registered" | "cancelled";
  /** The sessions they booked. */
  sessionIds: readonly string[];
};

export const HALL_MAIN = "9b3c1a00-0001-4d00-8000-000000000001";
export const HALL_A = "9b3c1a00-0001-4d00-8000-000000000002";
export const HALL_B = "9b3c1a00-0001-4d00-8000-000000000003";
export const HALL_LAB = "9b3c1a00-0001-4d00-8000-000000000004";

export const SAMPLE_HALLS: readonly SampleHall[] = [
  { id: HALL_MAIN, name: "Main Hall", seats: 600, isActive: true },
  { id: HALL_A, name: "Hall A", seats: 300, isActive: true },
  { id: HALL_B, name: "Hall B", seats: 300, isActive: true },
  { id: HALL_LAB, name: "Lab 3", seats: 60, isActive: true },
];

const speaker = (
  n: number,
  name: string,
  headline: string,
  profile: SampleSpeaker["profile"] = "complete",
): SampleSpeaker => ({
  id: `9b3c1a00-0002-4d00-8000-${String(n).padStart(12, "0")}`,
  name,
  headline,
  profile,
});

const ANANYA = speaker(
  1,
  "Ananya Rao",
  "Principal Frontend Engineer, Northwind Labs",
);
const MEERA = speaker(2, "Meera Joshi", "Head of Design Systems, Brightwave");
const VIKRAM = speaker(3, "Vikram Mehta", "Engineering Manager, Stackline");
const ARJUN = speaker(4, "Arjun Nair", "Staff Engineer, Platform, Corelight");
const PRIYA = speaker(
  5,
  "Priya Kulkarni",
  "Developer Advocate, Cloudnine",
  "missing_photo",
);
const SNEHA = speaker(6, "Sneha Desai", "Senior Product Designer, Brightwave");
const KARAN = speaker(7, "Karan Iyer", "SRE Lead, Corelight", "missing_bio");
const RHEA = speaker(8, "Rhea Thomas", "Design Engineer, Pixelforge");

export const SAMPLE_SPEAKERS: readonly SampleSpeaker[] = [
  ANANYA,
  MEERA,
  VIKRAM,
  ARJUN,
  PRIYA,
  SNEHA,
  KARAN,
  RHEA,
];

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

const session = (
  n: number,
  title: string,
  type: SampleSessionType,
  speakers: readonly SampleSpeaker[],
  place: {
    hallId: string;
    day: number;
    start: number;
    end: number;
  } | null,
  rest: Partial<Pick<SampleSession, "price" | "cancelled" | "booked">> = {},
): SampleSession => ({
  id: `9b3c1a00-0003-4d00-8000-${String(n).padStart(12, "0")}`,
  title,
  type,
  hallId: place?.hallId ?? null,
  day: place?.day ?? null,
  startMinute: place?.start ?? null,
  endMinute: place?.end ?? null,
  speakerIds: speakers.map((s) => s.id),
  price: rest.price ?? 0,
  cancelled: rest.cancelled ?? false,
  booked: rest.booked ?? null,
});

export const SAMPLE_SESSIONS: readonly SampleSession[] = [
  session(
    1,
    "Opening Keynote: The State of Product Engineering",
    "keynote",
    [MEERA],
    { hallId: HALL_MAIN, day: 0, start: at(9, 30), end: at(10, 30) },
  ),
  session(2, "Design Systems at Scale", "panel", [MEERA, VIKRAM, SNEHA], {
    hallId: HALL_MAIN,
    day: 0,
    start: at(15),
    end: at(16),
  }),
  session(3, "Measuring Developer Experience", "talk", [ARJUN], {
    hallId: HALL_A,
    day: 0,
    start: at(10),
    end: at(11),
  }),
  session(4, "Designing Accessible Data Tables", "talk", [MEERA], {
    hallId: HALL_A,
    day: 0,
    start: at(11, 30),
    end: at(12, 30),
  }),
  session(5, "State Management Beyond Redux", "talk", [PRIYA], {
    hallId: HALL_A,
    day: 0,
    start: at(13, 30),
    end: at(14, 30),
  }),
  session(
    6,
    "Scaling Next.js Applications: Lessons from Production",
    "talk",
    [ANANYA, VIKRAM],
    { hallId: HALL_B, day: 0, start: at(10), end: at(11, 30) },
  ),
  session(7, "Edge Rendering Explained", "talk", [VIKRAM], {
    hallId: HALL_B,
    day: 0,
    start: at(11, 30),
    end: at(12, 30),
  }),
  session(8, "Observability for Frontend Teams", "talk", [KARAN], {
    hallId: HALL_B,
    day: 0,
    start: at(13),
    end: at(13, 45),
  }),
  session(
    9,
    "Micro-frontends in Practice",
    "talk",
    [ARJUN],
    { hallId: HALL_B, day: 0, start: at(16, 30), end: at(17, 30) },
    { cancelled: true },
  ),
  session(
    10,
    "Hands-on: Type-safe APIs with TypeScript and Zod",
    "workshop",
    [ANANYA],
    { hallId: HALL_LAB, day: 0, start: at(14), end: at(16) },
    { price: 50000, booked: 60 },
  ),
  session(11, "Platform Teams at Scale", "panel", [ARJUN, PRIYA], null),
  session(12, "Design Tokens in Practice", "workshop", [], null, {
    price: 50000,
  }),
];

const attendee = (
  n: number,
  name: string,
  email: string,
  registeredAt: string,
  sessions: readonly SampleSession[],
  status: SampleAttendee["status"] = "registered",
): SampleAttendee => ({
  id: `9b3c1a00-0004-4d00-8000-${String(n).padStart(12, "0")}`,
  name,
  email,
  registeredAt,
  status,
  sessionIds: sessions.map((s) => s.id),
});

const [KEYNOTE, , NEXT_TALK, TABLES, REDUX, , EDGE, OBSERVABILITY, , WORKSHOP] =
  SAMPLE_SESSIONS;

export const SAMPLE_ATTENDEES: readonly SampleAttendee[] = [
  attendee(
    1,
    "Rahul Sharma",
    "rahul.sharma@example.com",
    "2026-10-12T09:15:00.000Z",
    [KEYNOTE, TABLES, WORKSHOP],
  ),
  attendee(
    2,
    "Neha Kapoor",
    "neha.kapoor@example.com",
    "2026-10-14T11:40:00.000Z",
    [KEYNOTE, NEXT_TALK, REDUX, WORKSHOP],
  ),
  attendee(
    3,
    "Amit Verma",
    "amit.verma@example.com",
    "2026-10-15T07:05:00.000Z",
    [],
  ),
  attendee(
    4,
    "Pooja Iyer",
    "pooja.iyer@example.com",
    "2026-10-18T14:20:00.000Z",
    [KEYNOTE, EDGE],
  ),
  attendee(
    5,
    "Sandeep Kulkarni",
    "sandeep.k@example.com",
    "2026-10-19T10:00:00.000Z",
    [],
    "cancelled",
  ),
  attendee(
    6,
    "Divya Menon",
    "divya.menon@example.com",
    "2026-10-21T16:45:00.000Z",
    [KEYNOTE, NEXT_TALK, TABLES, OBSERVABILITY, WORKSHOP],
  ),
  attendee(
    7,
    "Farhan Shaikh",
    "farhan.shaikh@example.com",
    "2026-10-22T08:30:00.000Z",
    [KEYNOTE],
  ),
  attendee(
    8,
    "Isha Patil",
    "isha.patil@example.com",
    "2026-10-24T12:10:00.000Z",
    [KEYNOTE, TABLES, REDUX],
  ),
  attendee(
    9,
    "Kabir Singh",
    "kabir.singh@example.com",
    "2026-10-25T09:50:00.000Z",
    [NEXT_TALK, EDGE],
  ),
  attendee(
    10,
    "Lata Deshmukh",
    "lata.deshmukh@example.com",
    "2026-10-26T15:25:00.000Z",
    [KEYNOTE, OBSERVABILITY],
    "cancelled",
  ),
];

/** The totals the Attendees tab shows above the table (the rows are only a page of them). */
export const SAMPLE_ATTENDEE_TOTALS = {
  registered: 480,
  seats: 600,
  cancelled: 17,
  sessionBookings: 1286,
  checkedIn: 0,
} as const;
