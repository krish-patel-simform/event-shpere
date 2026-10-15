# EventSphere - Smart Event & Community Management Platform

**Project Type:** Frontend Proof of Concept (POC)

**Primary Objective:**

Build a modern event management platform that demonstrates production-level frontend engineering skills using a mocked backend and real-world third-party integrations.

The focus of this project is **not backend development**. All business data should be served through **JSON Server** or equivalent and consumed through REST APIs.

The objective is to learn how modern frontend applications are designed, structured, integrated, tested, monitored, and deployed.

---

# 1. Project Overview

EventSphere is a web application that allows users to:

- Discover events
- Register for events
- Build personalized schedules
- Explore speakers and sessions
- Participate in live polls
- Receive notifications
- Access event content in offline mode

The application should support the complete event lifecycle, from event discovery to post-event engagement.

---

# 2. Learning Objectives

- Build scalable Next.js applications
- Work with TypeScript in a real project
- Consume REST APIs
- Implement global state management
- Integrate third-party services
- Build Progressive Web Applications
- Work with real-time communication patterns
- Write automated tests
- Debug production issues
- Follow modern development workflows

---

# 3. Mandatory Technology Stack

| Category         | Technology                     |
| ---------------- | ------------------------------ |
| Framework        | Next.js                        |
| Language         | TypeScript                     |
| Styling          | Tailwind CSS                   |
| State Management | Redux Toolkit                  |
| Mock Backend     | JSON Server                    |
| Forms            | React Hook Form                |
| Validation       | Zod                            |
| Charts           | Apache ECharts                 |
| CMS              | Strapi, Contentful, or Hygraph |
| Payments         | Stripe                         |
| Error Monitoring | Sentry                         |
| Code Quality     | SonarQube                      |
| Testing          | Jest + Playwright              |
| Deployment       | Vercel                         |

---

# 4. User Roles

## Guest

Permissions:

- Browse events
- Search events
- View speakers
- View schedules

---

## Registered User

Permissions:

- Register for events
- Bookmark sessions
- Create a personal agenda
- Participate in polls
- Receive notifications

---

## Event Organizer

Permissions:

- Create events
- Publish announcements
- Manage sessions
- View analytics

---

# 5. Application Modules

---

# Module 1: Authentication

## Requirements

Users should be able to:

### User Registration

- Sign up using email

Required fields:

- First name
- Last name
- Email
- Password

---

### Login

Support:

- Email and password

---

### Profile Management

Users should be able to:

- Update profile information
- Change profile image
- Change password

---

### Forgot Password

Users should be able to:

- Request password reset
- Set a new password

---

# Module 2: Event Discovery

## Event Listing Page

Display:

- Event banner
- Event title
- Event category
- Event date
- Event location
- Ticket price
- Available seats

---

## Search

Implement:

- Search by event name

---

## Filtering

Support filtering by:

- Category
- Date
- Event type
- Free/Paid

---

## Sorting

Support sorting by:

- Date
- Popularity
- Price

---

# Module 3: Event Details

## Event Details Page

Display:

- Banner
- Description
- Agenda
- Speakers
- Sessions
- Venue information

---

## Session Schedule

Display:

- Session name
- Speaker
- Start time
- End time
- Session description

---

# Module 4: Event Registration

## Registration Workflow

Users should be able to:

- Register for events
- Cancel registration
- View registration status

---

## Stripe Integration

Implement:

### Free Ticket

- Instant registration

### Paid Ticket

Use Stripe Checkout to simulate payment.

Display:

- Payment confirmation
- Transaction history

---

# Module 5: Personal Agenda Builder

Users should be able to create their own schedules.

Implement:

- Add sessions
- Remove sessions
- Rearrange sessions

---

## Drag-and-Drop

Implement drag-and-drop functionality for:

- Session management
- Schedule organization

---

# Module 6: Speaker Directory

## Speaker List

Display:

- Photo
- Name
- Designation
- Company

---

## Speaker Profile

Display:

- Biography
- Social links
- Sessions
- Expertise

---

## Headless CMS Integration

All speaker data should be managed through a headless CMS.

Suggested content types:

- Speakers
- Event announcements
- Blog articles
- Session content

No hardcoded content should be used.

---

# Module 7: Live Polling

Implement an audience polling feature.

Users should be able to:

- Answer questions
- Submit votes
- View results

---

## Poll Types

Support:

- Single choice
- Multiple choice

---

## Results Visualization

Display results using dynamic charts.

Supported charts:

- Bar charts
- Pie charts
- Donut charts

---

# Module 8: Notification Center

Implement notifications for:

- Event reminders
- Registration confirmations
- Session updates
- Poll announcements

---

## Server-Sent Events (SSE)

Use SSE to simulate:

- Real-time notifications
- Live announcements

Mocked events are acceptable.

---

# Module 9: Analytics Dashboard

Create an organizer dashboard.

Display:

| Widget              | Visualization |
| ------------------- | ------------- |
| Total registrations | KPI card      |
| Ticket sales        | Line chart    |
| Event attendance    | Bar chart     |
| Poll participation  | Pie chart     |
| Session popularity  | Donut chart   |

---

## Dashboard Features

Support:

- Date filtering
- Interactive charts
- Data refresh

---

# Module 10: Progressive Web Application (PWA)

Implement:

- Installable application
- Offline mode
- Cached assets
- Cached schedules

Users should be able to access previously viewed event data without an internet connection.

---

# 6. State Management Requirements

Use Redux Toolkit to manage:

- Authentication
- User profile
- Events
- Registrations
- Notifications
- Polling data
- Dashboard data

Avoid excessive prop drilling.

---

# 7. Error Handling Requirements

The application should handle:

- API failures
- Invalid form submissions
- Network interruptions
- Missing data

Display meaningful error messages.

---

# 8. Monitoring

## Sentry Integration

Capture:

- JavaScript exceptions
- Unhandled promise rejections
- API failures

---

# 9. Code Quality

## SonarQube

The project should pass:

- Security checks
- Code smell detection
- Duplication analysis

---

# 10. Testing Requirements

## Unit Testing

Write tests for:

- Utility functions
- State management
- Form validation

---

## End-to-End Testing

Automate the following user journeys:

- User registration
- Login
- Event registration
- Poll participation
- Payment flow

---

# 11. Deployment Requirements

Deploy the application to Vercel.

The deployed application must include:

- Working environment variables
- Production build
- Accessible URL

---

# 12. Git Workflow

Follow the branching strategy below:

- main
- develop
- feature/authentication
- feature/events
- feature/payments
- feature/dashboard

---

# 13. Deliverables

The team must submit:

- Source code repository
- Live application URL
- API collection
- Test report
- Technical documentation

---

# 14. Weekly Milestones

| Week   | Deliverables                        |
| ------ | ----------------------------------- |
| Week 1 | Authentication + Event Listing      |
| Week 2 | Search + Filtering + Event Details  |
| Week 3 | Registration + Stripe Integration   |
| Week 4 | Agenda Builder + Drag-and-Drop      |
| Week 5 | Speaker Directory + CMS Integration |
| Week 6 | Polling + SSE Notifications         |
| Week 7 | Analytics Dashboard                 |
| Week 8 | PWA + Testing + Deployment          |

---

# 15. Evaluation Criteria

| Category                 | Weight |
| ------------------------ | ------ |
| Feature completion       | 30%    |
| Code quality             | 20%    |
| Testing                  | 15%    |
| Third-party integrations | 15%    |
| UI/UX                    | 10%    |
| Documentation            | 10%    |

---

# Bonus Features (Optional)

- QR code-based event check-in
- Dark mode
- Export agenda to Google Calendar
- Infinite scrolling
- Event sharing
- AI-powered event recommendations

---

# Definition of Done

The project will be considered complete when:

- All mandatory modules are implemented.
- The application is deployed.
- All integrations are functional.
- Test cases are passing.
- Code review feedback is addressed.
- Documentation is complete.
