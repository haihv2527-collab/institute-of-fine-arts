/**
 * Seed script — creates one account per role plus a little sample data
 * so the site is not empty on first run.
 *
 * Run with:  npm run seed
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const hash = (pw) => bcrypt.hashSync(pw, 10);

function upsertUser({ username, password, role, full_name, email, phone }) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return existing.id;
  const result = db
    .prepare(
      `INSERT INTO users (username, password_hash, role, full_name, email, phone)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(username, hash(password), role, full_name, email, phone || null);
  return result.lastInsertRowid;
}

console.log("Seeding Institute of Fine Arts database...");

const tx = db.transaction(() => {
  const adminId = upsertUser({
    username: "admin", password: "admin123", role: "admin",
    full_name: "System Administrator", email: "admin@ifa.edu",
  });

  const managerId = upsertUser({
    username: "manager", password: "manager123", role: "manager",
    full_name: "Nguyen Van Quan", email: "manager@ifa.edu",
  });

  const staffUserId = upsertUser({
    username: "teacher", password: "teacher123", role: "staff",
    full_name: "Le Thi Hoa", email: "hoa.le@ifa.edu",
  });
  if (!db.prepare("SELECT id FROM staffs WHERE user_id = ?").get(staffUserId)) {
    db.prepare(`INSERT INTO staffs (user_id, subject, classes, joined_date) VALUES (?, ?, ?, ?)`)
      .run(staffUserId, "Watercolor Painting", "Class A, Class B", "2022-09-01");
  }

  // A second judge — multi-judge scoring is only interesting to demo with
  // more than one staff member scoring the same painting.
  const staff2UserId = upsertUser({
    username: "teacher2", password: "teacher123", role: "staff",
    full_name: "Pham Van Duc", email: "duc.pham@ifa.edu",
  });
  if (!db.prepare("SELECT id FROM staffs WHERE user_id = ?").get(staff2UserId)) {
    db.prepare(`INSERT INTO staffs (user_id, subject, classes, joined_date) VALUES (?, ?, ?, ?)`)
      .run(staff2UserId, "Oil Painting", "Class A", "2023-01-15");
  }

  const studentUserId = upsertUser({
    username: "student", password: "student123", role: "student",
    full_name: "Tran Minh Anh", email: "minhanh@ifa.edu",
  });
  if (!db.prepare("SELECT id FROM students WHERE user_id = ?").get(studentUserId)) {
    db.prepare(
      `INSERT INTO students (user_id, admission_no, admission_date, class_name) VALUES (?, ?, ?, ?)`
    ).run(studentUserId, "IFA-2024-001", "2024-09-01", "Class A");
  }

  // A sample competition
  const compExisting = db.prepare("SELECT id FROM competitions WHERE title = ?").get("Autumn Watercolor Contest");
  if (!compExisting) {
    db.prepare(
      `INSERT INTO competitions (title, description, conditions, prize, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'ongoing', ?)`
    ).run(
      "Autumn Watercolor Contest",
      "A friendly contest celebrating autumn scenery, open to all enrolled students.",
      "One entry per student. Watercolor medium only. JPEG upload required.",
      "Certificate + feature in the annual exhibition",
      "2026-06-01", "2026-12-31", adminId
    );
  }

  console.log("Seed complete.");
  console.log("  admin     / admin123");
  console.log("  manager   / manager123");
  console.log("  teacher   / teacher123  (staff, judge #1)");
  console.log("  teacher2  / teacher123  (staff, judge #2)");
  console.log("  student   / student123");
});

tx();
