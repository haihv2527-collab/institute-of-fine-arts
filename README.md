# Institute of Fine Arts — Competition & Exhibition Management System

A full-stack web app for running student painting competitions and exhibitions:
online submissions, staff judging, awards, and exhibition sales tracking —
replacing the paper-based process end to end.

## Project structure

```
institute-of-fine-arts/
├── backend/                   Node.js + Express REST API
│   ├── server.js              App entry point (Express + Socket.io on one HTTP server)
│   ├── config/db.js           SQLite connection + schema bootstrap
│   ├── models/
│   │   ├── schema.sql         Full database schema
│   │   └── seed.js            Demo accounts + sample data (npm run seed)
│   ├── middleware/
│   │   ├── auth.middleware.js JWT verification
│   │   ├── role.middleware.js Role-based access control (RBAC)
│   │   └── upload.middleware.js  Multer config for JPEG painting uploads
│   ├── realtime/socket.js     Socket.io setup — JWT-authenticated, room-based events
│   ├── controllers/           One file per resource (admin, competition,
│   │                          submission, award, exhibition, manager, home, auth)
│   ├── routes/                Express routers wired to controllers
│   ├── utils/
│   │   ├── generateToken.js   JWT signing helper
│   │   └── mailer.js          Email notifications (real SMTP or console fallback)
│   └── uploads/submissions/   Uploaded painting files (created at runtime)
│
└── frontend/                  Static multi-page site (vanilla HTML/CSS/JS)
    ├── index.html             Public home page
    ├── login.html             Sign in
    ├── css/style.css          Design system (shared by every page)
    ├── js/api.js              Fetch wrapper + auth/session helpers
    ├── js/layout.js           Shared header + dashboard sidebar renderer
    ├── js/realtime.js         Socket.io client — connects once logged in, shows toasts
    ├── js/vendor/socket.io.min.js  Self-hosted client library (no external CDN needed)
    ├── js/home.js
    ├── admin/                 Administrator module
    ├── manager/                Manager module
    ├── staff/                  Staff (teacher) module
    └── student/                 Student module
```

## Why this structure

Each user role described in the spec (Administrator, Manager, Staff, Student)
maps to its own folder on the frontend and its own route/controller pair on
the backend, so a developer can work on one role without touching another.
Shared concerns (auth, layout, the API wrapper, the design system) live in
one place each and are reused everywhere — nothing is duplicated per page.

## Getting started

### 1. Backend

```bash
cd backend
cp .env.example .env      # adjust JWT_SECRET etc. if you like
npm install
npm run seed               # creates demo accounts + one sample competition
npm start                  # http://localhost:4000
```

The Express server also serves the `frontend/` folder as static files, so
once it's running you can open **http://localhost:4000** directly — no
separate frontend server or build step needed.

### 2. Demo accounts and sample data (created by `npm run seed`)

| Role      | Username   | Password     |
|-----------|------------|--------------|
| Admin     | admin      | admin123     |
| Manager   | manager    | manager123   |
| Staff     | teacher    | teacher123   |
| Staff     | teacher2   | teacher123   |
| Student   | student    | student123   |

Two staff accounts are seeded on purpose — multi-judge scoring (below) is
only interesting to try out with more than one judge scoring the same
painting.

The seed script also creates **9 more student accounts** (username /
`student123`, e.g. `lan.nguyen`, `hung.le`, `mai.pham`... — see
`backend/models/seed.js` for the full list, or check Admin → Student
Accounts after seeding) so lists, filters, and reports aren't staring at
empty/near-empty tables. In total, seeding creates:

- **10 students** across 3 classes
- **6 competitions** — 2 upcoming, 2 ongoing, 2 closed, so every status
  and filter can be exercised immediately
- **13 submissions**, most fully scored by both judges (with realistic
  varied marks and remarks), a couple left partially/un-scored on
  purpose to demo the "unmarked" and "not yet scored by me" filters
- **5 awards** tied to the closed competitions' best submissions
- **3 exhibitions** — one closed with sales history, one ongoing with a
  mix of sold/on-display paintings, one upcoming and empty
- **12 placeholder painting images** (`backend/seed-assets/paintings/`,
  tracked in git) that seeding copies into `uploads/submissions/` under
  fresh filenames — so painted thumbnails actually render instead of
  showing broken images

Re-running `npm run seed` is always safe — every insert checks whether
its row already exists first, so nothing gets duplicated.

## Core features implemented

**Home Page (public)**
- Ongoing / upcoming competitions with live entry counts
- Recently awarded students

**Administrator**
- Full CRUD for Staff accounts (subject, classes, contact info)
- Full CRUD for Student accounts (admission info, guardian info, class)
- Search across both

**Staff (Teacher)**
- Create / edit / delete competitions (dates, conditions, prize)
- View every submission with painting, description, and quote/poem
- Score submissions as part of a judging panel — see "Multi-judge scoring" below
- Filter submissions by competition, by mark, or by "not yet scored by me"
- Give awards, linked to a competition and optionally a specific submission
- Create / edit / delete exhibitions
- Select marked submissions (filterable by mark) to feature in an exhibition
- Track sale status per exhibited painting: asking price, sold price, buyer
  info, and whether (and exactly when) the student has been paid
- Filter exhibition paintings by status, or isolate "sold — payment
  pending" to chase up outstanding payments quickly
- Filter awards by competition

**Student**
- Browse ongoing/upcoming competitions
- Upload a painting (JPEG only) with description and an optional poem/quote
- Edit or delete their own submission — blocked automatically once the
  competition's end date has passed
- View every judge's individual mark and remark once graded, plus the
  aggregate result, updating live as new scores come in
- View which of their paintings are in an exhibition, and its sale status

**Manager**
- Dashboard with system-wide counts
- Reports: all "Best"-marked submissions, every staff remark (for
  oversight), and all completed exhibition sales — best-submissions and
  remarks filterable by competition, sales filterable to unpaid-only

## Extended features

Three features were added on top of the original spec to address a real
gap (single-judge scoring isn't how most art competitions actually work)
and to make the system feel alive rather than purely request/response:

### 1. Multi-judge scoring

Any number of staff members can independently score the same submission.
Each judge's own mark + remark is stored as its own row
(`judge_scores`, unique per submission+judge — submitting again updates
your own score, it never creates a duplicate). The submission's overall
`mark`/`remark` — the columns everything else in the app already reads
(home page, exhibition selection, manager reports) — is a **cached
aggregate**, recomputed after every judge action:

- If **any** judge marks a piece `Disqualified`, the aggregate is
  `Disqualified`, full stop — one judge can veto regardless of other scores.
- Otherwise, each mark maps to a point value (`Normal`=1 … `Best`=5), the
  aggregate is the **rounded average**, mapped back to the nearest label.
  *Example: Good (3) + Best (5) → average 4 → "Better".*
- The combined remark shown everywhere is every judge's remark
  concatenated with their name and mark, e.g.
  `Le Thi Hoa (Good): Nice palette | Pham Van Duc (Best): Great light`.

New endpoints: `GET/POST/DELETE /api/submissions/:id/scores`. The old
single-judge `PATCH /api/submissions/:id/mark` endpoint was removed —
scoring now always goes through this panel-based flow. On the Staff
"Judge Submissions" page, each card shows the aggregate mark and how many
judges have scored it; opening a card shows every judge's individual
score plus a form to add or update *your own*. Students see the same
per-judge breakdown (judge name, mark, remark) on "My Submissions."

### 2. Real-time updates (Socket.io)

A Socket.io server runs alongside the REST API on the same HTTP server
and port — no separate process. Every socket connection is authenticated
with the same JWT used for REST calls (sent via the connection handshake,
verified server-side before the socket joins any room), then joins two
rooms: `user:<their id>` (for personal notifications) and
`role:<their role>` (for broadcast-to-role notifications).

Events wired up:

| Event              | Fired when...                          | Sent to             |
|---------------------|-----------------------------------------|----------------------|
| `submission:new`    | a student uploads a painting            | all connected staff  |
| `submission:scored` | a judge adds/updates their score        | that student only    |
| `award:new`         | staff creates an award                  | the winning student  |
| `exhibition:sold`   | staff marks an exhibited painting sold  | that student only    |

The frontend (`js/realtime.js`) turns each event into a toast
notification, and pages that show a live list (Staff → Judge Submissions,
Student → My Submissions) re-fetch automatically when a relevant event
arrives — no manual refresh needed to see a new submission appear or a
score come in. The client library is self-hosted at
`frontend/js/vendor/socket.io.min.js` (copied from the npm package), so
the app has no runtime dependency on an external CDN.

### 3. Email notifications

`backend/utils/mailer.js` sends an email at the same three moments a
socket event fires to a specific student: when their submission is
scored, when they win an award, and when their exhibited painting sells.

It's genuinely optional to configure: if `SMTP_HOST` is left blank in
`.env`, sent emails are printed to the server console instead of actually
being delivered — so the whole notification flow is fully demoable with
zero setup, and failing/unconfigured email can never break the API
request that triggered it (`sendMail()` catches its own errors). To send
real email, fill in `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS`
in `.env` — see the comments in `.env.example` for a Gmail App Password
example.

## Technical notes

- **Auth**: JWT-based. Token stored in `localStorage`, sent as
  `Authorization: Bearer <token>`. `Auth.guard(["role", ...])` on every
  protected page redirects to `/login.html` (or the correct dashboard) if
  the session is missing or the role doesn't match.
- **RBAC**: enforced server-side in `middleware/role.middleware.js` — the
  frontend guard is a convenience, not the security boundary.
- **File uploads**: `multer` restricts uploads to `image/jpeg`, stores them
  in `backend/uploads/submissions/`, served at `/uploads/submissions/<file>`.
- **Deadline enforcement**: submission create/edit/delete all check the
  competition's `end_date` server-side, so a late request is rejected even
  if the UI is bypassed.
- **Database**: SQLite via `better-sqlite3` — zero setup, file-based, easy
  to inspect (`backend/data/ifa.db`). Swap for Postgres/MySQL later by
  replacing `config/db.js` and adapting the (mostly standard) SQL. The
  database file itself is gitignored (see `.gitignore`) — `npm run seed`
  is what gives every clone of the repo the same rich sample data,
  rather than committing a binary `.db` file that can't be diffed or
  merged and would conflict badly the moment two people edit it.

## Suggested next steps for a developer picking this up

1. Add password-reset / "first login must change password" flow.
2. Add pagination to submission and student/staff lists once data grows.
3. Add automated tests for the controllers (the RBAC + deadline logic in
   particular is worth locking down with tests, and the judge-score
   aggregation math is a great unit-test candidate).
4. Move file storage to S3 or similar if deploying beyond a single server.
5. If deploying with multiple backend instances behind a load balancer,
   swap Socket.io's default in-memory adapter for the Redis adapter
   (`@socket.io/redis-adapter`) so realtime events reach a user regardless
   of which instance their socket connected to.
