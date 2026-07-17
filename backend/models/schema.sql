-- ============================================================
-- Institute of Fine Arts — Database Schema (SQLite)
-- ============================================================

-- USERS: one row per login account, role-based access control
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'student')),
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- STUDENTS: extended profile for users with role = student
CREATE TABLE IF NOT EXISTS students (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admission_no    TEXT UNIQUE,
  admission_date  TEXT,
  date_of_birth   TEXT,
  address         TEXT,
  guardian_name   TEXT,
  guardian_phone  TEXT,
  class_name      TEXT
);

-- STAFF: extended profile for users with role = staff
CREATE TABLE IF NOT EXISTS staffs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      TEXT,
  classes      TEXT,
  joined_date  TEXT
);

-- COMPETITIONS
CREATE TABLE IF NOT EXISTS competitions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  conditions    TEXT,
  prize         TEXT,
  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','closed')),
  created_by    INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SUBMISSIONS: one painting entry from a student into a competition
CREATE TABLE IF NOT EXISTS submissions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title          TEXT,
  image_path     TEXT NOT NULL,
  description    TEXT,
  quote          TEXT,
  submitted_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  mark           TEXT CHECK (mark IN ('Best','Better','Good','Moderate','Normal','Disqualified')),
  remark         TEXT,
  marked_by      INTEGER REFERENCES users(id),
  marked_at      TEXT,
  UNIQUE(competition_id, student_id, title)
);

-- AWARDS
CREATE TABLE IF NOT EXISTS awards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  competition_id INTEGER NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  submission_id  INTEGER REFERENCES submissions(id) ON DELETE SET NULL,
  student_id     INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  award_name     TEXT NOT NULL,
  description    TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- EXHIBITIONS
CREATE TABLE IF NOT EXISTS exhibitions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  start_date   TEXT NOT NULL,
  end_date     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','closed')),
  created_by   INTEGER REFERENCES users(id),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- EXHIBITION_PAINTINGS: paintings selected from submissions to be exhibited/sold
CREATE TABLE IF NOT EXISTS exhibition_paintings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  exhibition_id     INTEGER NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  submission_id     INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  asking_price      REAL,
  status            TEXT NOT NULL DEFAULT 'on_display' CHECK (status IN ('on_display','sold','returned')),
  sold_price        REAL,
  customer_name     TEXT,
  customer_contact  TEXT,
  paid_to_student   INTEGER NOT NULL DEFAULT 0,
  sold_at           TEXT,
  UNIQUE(exhibition_id, submission_id)
);

-- JUDGE_SCORES: one row per (submission, judge) — supports a panel of
-- multiple staff members independently scoring the same painting.
-- The submission's cached mark/remark columns above are recomputed
-- automatically from these rows every time one changes (see
-- submission.controller.js -> recomputeAggregate()).
CREATE TABLE IF NOT EXISTS judge_scores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id  INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  judge_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mark           TEXT NOT NULL CHECK (mark IN ('Best','Better','Good','Moderate','Normal','Disqualified')),
  remark         TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(submission_id, judge_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_competition ON submissions(competition_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_exhibition_paintings_exhibition ON exhibition_paintings(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_judge_scores_submission ON judge_scores(submission_id);
