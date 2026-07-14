# Institute of Fine Arts — Competition & Exhibition Management System

A full-stack web app for running student painting competitions and exhibitions:
online submissions, staff judging, awards, and exhibition sales tracking —
replacing the paper-based process end to end.

## Project structure

```
institute-of-fine-arts/
├── backend/                   Node.js + Express REST API
│   ├── server.js              App entry point
│   ├── config/db.js           SQLite connection + schema bootstrap
│   ├── models/
│   │   ├── schema.sql         Full database schema
│   │   └── seed.js            Demo accounts + sample data (npm run seed)
│   ├── middleware/
│   │   ├── auth.middleware.js JWT verification
│   │   ├── role.middleware.js Role-based access control (RBAC)
│   │   └── upload.middleware.js  Multer config for JPEG painting uploads
│   ├── controllers/           One file per resource (admin, competition,
│   │                          submission, award, exhibition, manager, home, auth)
│   ├── routes/                Express routers wired to controllers
│   ├── utils/generateToken.js JWT signing helper
│   └── uploads/submissions/   Uploaded painting files (created at runtime)
│
└── frontend/                  Static multi-page site (vanilla HTML/CSS/JS)
    ├── index.html             Public home page
    ├── login.html             Sign in
    ├── css/style.css          Design system (shared by every page)
    ├── js/api.js              Fetch wrapper + auth/session helpers
    ├── js/layout.js           Shared header + dashboard sidebar renderer
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

### 2. Demo accounts (created by `npm run seed`)

| Role      | Username  | Password     |
|-----------|-----------|--------------|
| Admin     | admin     | admin123     |
| Manager   | manager   | manager123   |
| Staff     | teacher   | teacher123   |
| Student   | student   | student123   |

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
- Mark submissions: Best, Better, Good, Moderate, Normal, Disqualified
- Write remarks (strengths, weaknesses, suggestions) per submission
- Filter submissions by competition and by mark
- Give awards, linked to a competition and optionally a specific submission
- Create / edit / delete exhibitions
- Select marked submissions (filterable by mark) to feature in an exhibition
- Track sale status per exhibited painting: asking price, sold price, buyer
  info, and whether the student has been paid

**Student**
- Browse ongoing/upcoming competitions
- Upload a painting (JPEG only) with description and an optional poem/quote
- Edit or delete their own submission — blocked automatically once the
  competition's end date has passed
- View their mark and teacher's remark once graded
- View which of their paintings are in an exhibition, and its sale status

**Manager**
- Dashboard with system-wide counts
- Reports: all "Best"-marked submissions, every staff remark (for
  oversight), and all completed exhibition sales

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
  replacing `config/db.js` and adapting the (mostly standard) SQL.

## Suggested next steps for a developer picking this up

1. Add password-reset / "first login must change password" flow.
2. Add pagination to submission and student/staff lists once data grows.
3. Add email notifications (e.g. on being marked, on a painting selling).
4. Add automated tests for the controllers (the RBAC + deadline logic in
   particular is worth locking down with tests).
5. Move file storage to S3 or similar if deploying beyond a single server.
