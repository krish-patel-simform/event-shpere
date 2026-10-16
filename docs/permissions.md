# EventSphere – Permissions

Role-based access matrix for the platform. This file is the source of truth for **who may do what**; services enforce it (`route → service → repository`, see the `auth-roles` and `backend-security` skills).

## Roles

A **Guest is not a role**. A guest has no account and no session, so there is no `user_roles` row to hold a role and nothing to attach permissions to. Guests simply use the public routes (see Public access below). Every other route is protected by default: no session returns 401 before any permission is looked up.

Every account has the base `user` role. Speakers, Organizers and Admins also keep it, so the abilities of a Registered User are always included.

| Role | DB value (`role_name`) | Session | Summary |
| --- | --- | --- | --- |
| Registered User | `user` | yes | Attendee: registers for events, pays, builds a personal schedule, votes. |
| Speaker | `speaker` | yes | Attendee abilities plus managing own speaker profile, own session materials and own session polls. |
| Organizer | `organizer` | yes | Creates and runs events; manages sessions, speakers, polls, attendees, payments and analytics **for events they organize**. |
| Admin | `admin` | yes | Platform operator: same abilities as Organizer on **any** event, plus users, CMS content, moderation and platform-wide views. |

## Public access (no role, no permission)

These need no session and no permission check, for guests and signed-in users alike. Routes and pages for them simply do not call the auth guard.

- Browse and search events, and open event details (formerly `EVENT_VIEW`, `EVENT_SEARCH`)
- View the speaker list and speaker profiles (formerly `SPEAKER_VIEW`)
- View session details (formerly `SESSION_VIEW`)
- View the public agenda of an event (formerly `SCHEDULE_VIEW`)
- Sign up, sign in, and request a password reset

Sign-up and sign-in are not permissions: they are open to everyone by definition, so they are not listed here (see Changes below).

## Scope legend

| Scope | Meaning |
| --- | --- |
| Own | Only records belonging to the signed-in user. |
| Assigned | Only sessions the user is assigned to as a speaker. |
| Event | Only events the user organizes (ownership checked in the service; foreign events return 404). |
| All | Any record on the platform. |
| — | Not scope-limited (role check only). |

Where one permission is shared by Organizer and Admin, the scope differs by role and is written as `Event (Organizer) / All (Admin)`.

## Permissions

### Profile
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 1 | PROFILE_VIEW | View own profile and account details | Own | Registered User, Speaker, Organizer, Admin |
| 2 | PROFILE_MANAGE | Edit own name, photo, interests, and password | Own | Registered User, Speaker, Organizer, Admin |

### Events
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 3 | EVENT_CREATE | Create a new event (saved as draft) | — | Organizer, Admin |
| 4 | EVENT_MANAGE_OWN | Update, cancel, or delete events the user created | Own | Organizer |
| 5 | EVENT_MANAGE_ALL | Update, cancel, or delete any event | All | Admin |
| 6 | EVENT_PUBLISH_OWN | Publish or unpublish events the user created | Own | Organizer |
| 7 | EVENT_PUBLISH_ALL | Publish or unpublish any event | All | Admin |

### Registrations
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 8 | REGISTRATION_CREATE | Register for an event | Own | Registered User, Speaker |
| 9 | REGISTRATION_VIEW_OWN | View own tickets and registrations | Own | Registered User, Speaker |
| 10 | REGISTRATION_VIEW_EVENT | View the attendee list of events the user organizes | Event | Organizer |
| 11 | REGISTRATION_VIEW_ALL | View every registration on the platform | All | Admin |
| 12 | REGISTRATION_MANAGE | Update or cancel own registration | Own | Registered User, Speaker |
| 13 | REGISTRATION_CHECKIN_EVENT | Check in attendees at events the user organizes | Event | Organizer |
| 14 | REGISTRATION_CHECKIN_ALL | Check in attendees at any event | All | Admin |

### Payments
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 15 | PAYMENT_CHECKOUT | Pay for paid tickets through Stripe | Own | Registered User, Speaker |
| 16 | PAYMENT_VIEW_OWN | View own payment history and receipts | Own | Registered User, Speaker |
| 17 | PAYMENT_VIEW_EVENT | View payments and revenue of events the user organizes | Event | Organizer |
| 18 | PAYMENT_VIEW_ALL | View all payments and revenue on the platform | All | Admin |
| 19 | PAYMENT_REFUND_EVENT | Issue refunds for tickets of events the user organizes | Event | Organizer |
| 20 | PAYMENT_REFUND_ALL | Issue refunds for any ticket | All | Admin |

### Speakers
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 21 | SPEAKER_CREATE | Add or invite speakers to events (Organizer: events they organize; Admin: any event) | Event (Organizer) / All (Admin) | Organizer, Admin |
| 22 | SPEAKER_MANAGE_OWN | Edit own speaker bio, photo, and social links | Own | Speaker |
| 23 | SPEAKER_MANAGE_EVENT | Edit or remove speakers in events the user organizes | Event | Organizer |
| 24 | SPEAKER_MANAGE_ALL | Edit or remove any speaker profile | All | Admin |

### Sessions
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 25 | SESSION_CREATE | Create sessions in events (Organizer: events they organize; Admin: any event) | Event (Organizer) / All (Admin) | Organizer, Admin |
| 26 | SESSION_MANAGE | Edit, reschedule, or delete sessions (Organizer: events they organize; Admin: any event) | Event (Organizer) / All (Admin) | Organizer, Admin |
| 27 | SESSION_MATERIAL_UPLOAD_ASSIGNED | Upload slides or resources for own sessions | Assigned | Speaker |
| 28 | SESSION_MATERIAL_UPLOAD_EVENT | Upload materials for sessions in events the user organizes | Event | Organizer |
| 29 | SESSION_MATERIAL_UPLOAD_ALL | Upload materials for any session | All | Admin |

### Personal schedule
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 30 | SCHEDULE_MANAGE | Add or remove sessions in own personal schedule | Own | Registered User, Speaker |
| 31 | SCHEDULE_EXPORT | Export own personal schedule to a calendar | Own | Registered User, Speaker |

### Polls
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 32 | POLL_VIEW | View polls and live results | — | Registered User, Speaker, Organizer, Admin |
| 33 | POLL_VOTE | Vote in a live poll | Own | Registered User, Speaker |
| 34 | POLL_CREATE_ASSIGNED | Create polls for own sessions | Assigned | Speaker |
| 35 | POLL_CREATE_EVENT | Create polls for sessions in events the user organizes | Event | Organizer |
| 36 | POLL_CREATE_ALL | Create polls for any session | All | Admin |
| 37 | POLL_MANAGE_ASSIGNED | Open, close, reset, edit, or delete polls in own sessions | Assigned | Speaker |
| 38 | POLL_MANAGE_EVENT | Open, close, reset, edit, or delete polls in events the user organizes | Event | Organizer |
| 39 | POLL_MANAGE_ALL | Open, close, reset, edit, or delete any poll | All | Admin |

### Notifications
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 40 | NOTIFICATION_VIEW | Receive and read own notifications | Own | Registered User, Speaker, Organizer, Admin |
| 41 | NOTIFICATION_MANAGE | Update own notification preferences | Own | Registered User, Speaker, Organizer, Admin |
| 42 | NOTIFICATION_SEND_EVENT | Send announcements to attendees of events the user organizes | Event | Organizer |
| 43 | NOTIFICATION_SEND_ALL | Send platform-wide announcements to all users | All | Admin |

### Analytics
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 44 | ANALYTICS_VIEW_EVENT | View dashboards and charts for events the user organizes | Event | Organizer |
| 45 | ANALYTICS_VIEW_ALL | View platform-wide dashboards and charts | All | Admin |

### Administration
| # | Permission Code | Description | Scope | Used By |
| --- | --- | --- | --- | --- |
| 46 | USER_VIEW | View all users on the platform | All | Admin |
| 47 | USER_ROLE_MANAGE | Change a user's role | All | Admin |
| 48 | USER_STATUS_MANAGE | Suspend or reactivate a user account | All | Admin |
| 49 | MODERATION_MANAGE | Remove inappropriate events, content, or poll entries | All | Admin |

**49 permissions** (64 in the original list; see Changes).

## Changes from the original list

| Change | Detail |
| --- | --- |
| Removed `EVENT_VIEW`, `EVENT_SEARCH`, `SPEAKER_VIEW`, `SESSION_VIEW`, `SCHEDULE_VIEW` | Guest is not a role, so it holds no permissions. These actions are open to everyone (guests and signed-in users), so they are public routes, not authorization decisions. See Public access above. |
| Removed `AUTH_REGISTER`, `AUTH_LOGIN` | Account creation and sign-in are open to everyone and are not authorization decisions, so they are not permissions. Sign-up, login and logout remain features (AUTH-1, AUTH-2, AUTH-9). |
| Merged `SPEAKER_CREATE_EVENT` + `SPEAKER_CREATE_ALL` → `SPEAKER_CREATE` | Same action for Organizer and Admin. The Event/All difference moved into the Scope column. |
| Merged `SESSION_CREATE_EVENT` + `SESSION_CREATE_ALL` → `SESSION_CREATE` | Same reason. |
| Merged `SESSION_MANAGE_EVENT` + `SESSION_MANAGE_ALL` → `SESSION_MANAGE` | Same reason. |
| Removed `OFFLINE_PUBLIC_VIEW`, `OFFLINE_PERSONAL_VIEW` | Offline mode is a client capability of the installed app (PWA-1..5), not a role-based permission. The data cached offline is already limited by the permissions the user has online (public pages for everyone, own tickets and schedule for signed-in users). |
| Removed `CONTENT_VIEW`, `CONTENT_CREATE`, `CONTENT_MANAGE` | CMS content is public to read, and creating or editing it happens inside the headless CMS with its own editor accounts, not through app roles. |

Implementation rule for merged permissions: the role check is "Organizer or Admin"; the **service** then applies the scope: an Organizer must own the event (`event.organizerId === actor.id`, otherwise 404), an Admin skips the ownership check.

Other `_EVENT` / `_ALL` / `_OWN` pairs (events, registrations, payments, speakers manage, material upload, polls, notifications, analytics) were left as in the original list because they were not part of the requested change.

## Open points (decisions needed before building)

1. **Roles (settled).** The database role enum is `user`, `speaker`, `organizer`, `admin` (`role_name` in `auth.schema.ts`). Guest is not a role. Spec §4 and the catalog still describe Guest / Registered User / Organizer only; `auth-roles` still describes Auth.js and the `USER | ORGANIZER` enum and needs updating to match.
2. **Organizer and Admin cannot register for events or vote** (REGISTRATION_CREATE, POLL_VOTE are Registered User / Speaker only). The earlier `auth-roles` skill assumed organizers are also attendees. Confirm this is intended.
3. **Speaker data lives in the CMS** (spec §6, CMS-1). `SPEAKER_CREATE` and `SPEAKER_MANAGE_*` imply in-app editing. Either speakers are edited in the CMS (these permissions then mean "CMS editor access" or an app screen that writes to the CMS), or a database speaker record is introduced. A user with the Speaker role also needs a link to their speaker entry (for example `users.speakerSlug`), and the "Assigned" scope needs sessions linked to that speaker.
4. **Permissions with no requirement in the catalog yet:** attendee list and check-in (BONUS-1 only covers QR check-in), refunds, payment/revenue views for organizers beyond DASH-2, material upload, notification preferences, user and moderation admin, platform-wide analytics and announcements, user interests and location filter, personal schedule export (BONUS-3).

## Mapping to the requirements catalog

| Permission area | Catalog IDs today |
| --- | --- |
| Profile | AUTH-3, AUTH-4, AUTH-5 |
| Events view/search | DISC-1..4, DET-1 |
| Event create/manage/publish | ORG-1 (partly: update, cancel, delete and publish are not itemized) |
| Registrations (create, view own, manage) | REG-1, REG-2, REG-3, REG-4 |
| Payments (checkout, view own) | REG-5, REG-6, REG-7 |
| Speakers view | SPK-1, SPK-2, CMS-1 |
| Sessions view/create/manage | DET-2, ORG-2 |
| Personal schedule | AGD-1..5 |
| Polls | POLL-1..5, ORG-4 |
| Notifications view, event announcements | NOTIF-1..7, ORG-3 |
| Analytics (organizer) | DASH-1..8, BE-6 |
| Everything else (attendee list, check-in, refunds, speaker/material management, preferences, user admin, moderation, platform-wide views) | not in the catalog |
