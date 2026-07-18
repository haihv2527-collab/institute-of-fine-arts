/**
 * Seed script — creates a rich set of demo data so the site looks
 * fully "lived in" the moment someone clones the repo: multiple
 * students, competitions in every status, multi-judge scored
 * submissions, awards, and exhibitions with sales history.
 *
 * Safe to re-run — every insert checks for an existing row first,
 * so `npm run seed` never creates duplicates.
 *
 * Run with:  npm run seed
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("../config/db");

const hash = (pw) => bcrypt.hashSync(pw, 10);
const ASSETS_DIR = path.join(__dirname, "..", "seed-assets", "paintings");
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "submissions");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Point scale used to aggregate multiple judges' marks — mirrors the
// logic in controllers/submission.controller.js so seeded submissions
// already carry a correct aggregate mark/remark on first run.
const MARK_POINTS = { Normal: 1, Moderate: 2, Good: 3, Better: 4, Best: 5 };
const POINT_TO_MARK = { 1: "Normal", 2: "Moderate", 3: "Good", 4: "Better", 5: "Best" };

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

function upsertStudent(userId, { admission_no, admission_date, class_name }) {
  if (db.prepare("SELECT id FROM students WHERE user_id = ?").get(userId)) return;
  db.prepare(
    `INSERT INTO students (user_id, admission_no, admission_date, class_name) VALUES (?, ?, ?, ?)`
  ).run(userId, admission_no, admission_date, class_name);
}

function upsertStaff(userId, { subject, classes, joined_date }) {
  if (db.prepare("SELECT id FROM staffs WHERE user_id = ?").get(userId)) return;
  db.prepare(
    `INSERT INTO staffs (user_id, subject, classes, joined_date) VALUES (?, ?, ?, ?)`
  ).run(userId, subject, classes, joined_date);
}

function upsertCompetition({ title, description, conditions, prize, start_date, end_date, created_by }) {
  const existing = db.prepare("SELECT id FROM competitions WHERE title = ?").get(title);
  if (existing) return existing.id;
  const today = new Date().toISOString().slice(0, 10);
  const status = today < start_date ? "upcoming" : today > end_date ? "closed" : "ongoing";
  const result = db
    .prepare(
      `INSERT INTO competitions (title, description, conditions, prize, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, description, conditions, prize, start_date, end_date, status, created_by);
  return result.lastInsertRowid;
}

/** Copies a seed painting asset into uploads/submissions/ with a fresh unique filename. */
function copyPaintingAsset(assetFilename) {
  const destName = `seed-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
  fs.copyFileSync(path.join(ASSETS_DIR, assetFilename), path.join(UPLOAD_DIR, destName));
  return destName;
}

/** Creates a submission if one with this competition+student+title doesn't already exist. */
function ensureSubmission({ competitionId, studentId, title, assetFilename, description, quote, submittedAt }) {
  const existing = db
    .prepare("SELECT id FROM submissions WHERE competition_id = ? AND student_id = ? AND title = ?")
    .get(competitionId, studentId, title);
  if (existing) return existing.id;

  const imagePath = copyPaintingAsset(assetFilename);
  const result = db
    .prepare(
      `INSERT INTO submissions (competition_id, student_id, title, image_path, description, quote, submitted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(competitionId, studentId, title, imagePath, description, quote || null, submittedAt);
  return result.lastInsertRowid;
}

/** Records a judge's score if that judge hasn't already scored this submission, then recomputes the aggregate. */
function ensureJudgeScore(submissionId, judgeId, mark, remark) {
  const existing = db
    .prepare("SELECT id FROM judge_scores WHERE submission_id = ? AND judge_id = ?")
    .get(submissionId, judgeId);
  if (!existing) {
    db.prepare(
      `INSERT INTO judge_scores (submission_id, judge_id, mark, remark) VALUES (?, ?, ?, ?)`
    ).run(submissionId, judgeId, mark, remark);
  }
  recomputeAggregate(submissionId);
}

function recomputeAggregate(submissionId) {
  const scores = db
    .prepare(
      `SELECT js.mark, js.remark, u.full_name AS judge_name
       FROM judge_scores js JOIN users u ON u.id = js.judge_id
       WHERE js.submission_id = ? ORDER BY js.created_at ASC`
    )
    .all(submissionId);
  if (scores.length === 0) return;

  let aggregateMark;
  if (scores.some((s) => s.mark === "Disqualified")) {
    aggregateMark = "Disqualified";
  } else {
    const avg = scores.reduce((sum, s) => sum + MARK_POINTS[s.mark], 0) / scores.length;
    aggregateMark = POINT_TO_MARK[Math.min(5, Math.max(1, Math.round(avg)))];
  }
  const combinedRemark = scores.filter((s) => s.remark).map((s) => `${s.judge_name} (${s.mark}): ${s.remark}`).join(" | ") || null;

  db.prepare(`UPDATE submissions SET mark = ?, remark = ?, marked_at = datetime('now') WHERE id = ?`)
    .run(aggregateMark, combinedRemark, submissionId);
}

function ensureAward({ competitionId, submissionId, studentId, awardName, description }) {
  const existing = db
    .prepare("SELECT id FROM awards WHERE competition_id = ? AND student_id = ? AND award_name = ?")
    .get(competitionId, studentId, awardName);
  if (existing) return existing.id;
  const result = db
    .prepare(
      `INSERT INTO awards (competition_id, submission_id, student_id, award_name, description) VALUES (?, ?, ?, ?, ?)`
    )
    .run(competitionId, submissionId, studentId, awardName, description);
  return result.lastInsertRowid;
}

function ensureExhibition({ title, description, location, start_date, end_date, created_by }) {
  const existing = db.prepare("SELECT id FROM exhibitions WHERE title = ?").get(title);
  if (existing) return existing.id;
  const today = new Date().toISOString().slice(0, 10);
  const status = today < start_date ? "upcoming" : today > end_date ? "closed" : "ongoing";
  const result = db
    .prepare(
      `INSERT INTO exhibitions (title, description, location, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, description, location, start_date, end_date, status, created_by);
  return result.lastInsertRowid;
}

function ensureExhibitionPainting({ exhibitionId, submissionId, askingPrice, status, soldPrice, customerName, paidToStudent }) {
  const existing = db
    .prepare("SELECT id FROM exhibition_paintings WHERE exhibition_id = ? AND submission_id = ?")
    .get(exhibitionId, submissionId);
  if (existing) return existing.id;
  const soldAt = status === "sold" ? new Date().toISOString() : null;
  const result = db
    .prepare(
      `INSERT INTO exhibition_paintings (exhibition_id, submission_id, asking_price, status, sold_price, customer_name, paid_to_student, sold_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(exhibitionId, submissionId, askingPrice, status, soldPrice || null, customerName || null, paidToStudent ? 1 : 0, soldAt);
  return result.lastInsertRowid;
}

console.log("Seeding Institute of Fine Arts database with a full demo data set...");

const tx = db.transaction(() => {
  // ----------------------- ACCOUNTS -----------------------

  const adminId = upsertUser({ username: "admin", password: "admin123", role: "admin", full_name: "System Administrator", email: "admin@ifa.edu" });
  upsertUser({ username: "manager", password: "manager123", role: "manager", full_name: "Nguyen Van Quan", email: "manager@ifa.edu" });

  const teacher1Id = upsertUser({ username: "teacher", password: "teacher123", role: "staff", full_name: "Le Thi Hoa", email: "hoa.le@ifa.edu" });
  upsertStaff(teacher1Id, { subject: "Watercolor Painting", classes: "Class A, Class B", joined_date: "2022-09-01" });

  const teacher2Id = upsertUser({ username: "teacher2", password: "teacher123", role: "staff", full_name: "Pham Van Duc", email: "duc.pham@ifa.edu" });
  upsertStaff(teacher2Id, { subject: "Oil Painting", classes: "Class A, Class C", joined_date: "2023-01-15" });

  // 10 students across 3 classes
  const studentDefs = [
    { username: "student", full_name: "Tran Minh Anh", admission_no: "IFA-2024-001", class_name: "Class A" },
    { username: "lan.nguyen", full_name: "Nguyen Thi Lan", admission_no: "IFA-2024-002", class_name: "Class A" },
    { username: "hung.le", full_name: "Le Van Hung", admission_no: "IFA-2024-003", class_name: "Class A" },
    { username: "mai.pham", full_name: "Pham Thi Mai", admission_no: "IFA-2024-004", class_name: "Class B" },
    { username: "nam.hoang", full_name: "Hoang Van Nam", admission_no: "IFA-2024-005", class_name: "Class B" },
    { username: "huong.vu", full_name: "Vu Thi Huong", admission_no: "IFA-2024-006", class_name: "Class B" },
    { username: "tuan.dang", full_name: "Dang Van Tuan", admission_no: "IFA-2024-007", class_name: "Class C" },
    { username: "ngoc.bui", full_name: "Bui Thi Ngoc", admission_no: "IFA-2024-008", class_name: "Class C" },
    { username: "phuc.do", full_name: "Do Van Phuc", admission_no: "IFA-2024-009", class_name: "Class C" },
    { username: "thu.ngo", full_name: "Ngo Thi Thu", admission_no: "IFA-2024-010", class_name: "Class A" },
  ];
  const studentUserIds = {};
  const studentIds = {};
  for (const s of studentDefs) {
    const userId = upsertUser({
      username: s.username, password: "student123", role: "student",
      full_name: s.full_name, email: `${s.username.replace(".", "_")}@ifa.edu`,
    });
    upsertStudent(userId, { admission_no: s.admission_no, admission_date: "2024-09-01", class_name: s.class_name });
    studentUserIds[s.username] = userId;
    studentIds[s.username] = db.prepare("SELECT id FROM students WHERE user_id = ?").get(userId).id;
  }

  // ----------------------- COMPETITIONS (mix of every status) -----------------------

  const compAutumn = upsertCompetition({
    title: "Autumn Watercolor Contest",
    description: "A friendly contest celebrating autumn scenery, open to all enrolled students.",
    conditions: "One entry per student. Watercolor medium only. JPEG upload required.",
    prize: "Certificate + feature in the annual exhibition",
    start_date: "2026-06-01", end_date: "2026-12-31", created_by: adminId,
  });
  const compInkWash = upsertCompetition({
    title: "Ink Wash Masters",
    description: "Explore traditional ink wash technique through modern subjects.",
    conditions: "Ink wash medium only. One entry per student.",
    prize: "Feature in the school newsletter",
    start_date: "2026-07-01", end_date: "2026-08-20", created_by: teacher1Id,
  });
  const compSpring = upsertCompetition({
    title: "Spring Portrait Challenge",
    description: "A portraiture competition held every spring semester.",
    conditions: "Any medium. Portrait subject required.",
    prize: "Cash prize + certificate",
    start_date: "2026-01-15", end_date: "2026-03-15", created_by: adminId,
  });
  const compSummer = upsertCompetition({
    title: "Summer Landscape Sprint",
    description: "A fast-paced landscape painting competition over the summer break.",
    conditions: "Landscape subject. Any medium.",
    prize: "Feature in the Summer Colors exhibition",
    start_date: "2026-04-01", end_date: "2026-05-15", created_by: teacher2Id,
  });
  const compWinter = upsertCompetition({
    title: "Winter Still Life Invitational",
    description: "An invitational still-life competition for advanced students.",
    conditions: "Still life subject. Oil or acrylic only.",
    prize: "Scholarship credit",
    start_date: "2027-01-10", end_date: "2027-02-20", created_by: adminId,
  });
  const compDigital = upsertCompetition({
    title: "Digital Illustration Fusion",
    description: "A new category exploring digital painting techniques.",
    conditions: "Digital medium, exported as JPEG.",
    prize: "Tablet stylus set",
    start_date: "2026-09-01", end_date: "2026-10-15", created_by: teacher1Id,
  });

  // ----------------------- SUBMISSIONS + MULTI-JUDGE SCORES -----------------------
  // Spring Portrait Challenge (closed) — fully judged by both teachers, feeds awards + an exhibition
  const sp1 = ensureSubmission({ competitionId: compSpring, studentId: studentIds["student"], title: "Grandmother's Smile", assetFilename: "painting-01.jpg", description: "A portrait of my grandmother in warm afternoon light.", quote: "Time carves the kindest lines.", submittedAt: "2026-02-01 10:00:00" });
  const sp2 = ensureSubmission({ competitionId: compSpring, studentId: studentIds["lan.nguyen"], title: "Self Portrait in Blue", assetFilename: "painting-02.jpg", description: "An exploration of identity through cool tones.", submittedAt: "2026-02-03 14:30:00" });
  const sp3 = ensureSubmission({ competitionId: compSpring, studentId: studentIds["hung.le"], title: "The Fisherman", assetFilename: "painting-03.jpg", description: "A portrait of a local fisherman I met on the coast.", submittedAt: "2026-02-05 09:15:00" });
  const sp4 = ensureSubmission({ competitionId: compSpring, studentId: studentIds["mai.pham"], title: "Twins", assetFilename: "painting-04.jpg", description: "A double portrait of my younger siblings.", submittedAt: "2026-02-10 16:00:00" });
  const sp5 = ensureSubmission({ competitionId: compSpring, studentId: studentIds["nam.hoang"], title: "Old Man and Pipe", assetFilename: "painting-05.jpg", description: "Inspired by classical portrait studies.", submittedAt: "2026-02-12 11:45:00" });

  ensureJudgeScore(sp1, teacher1Id, "Best", "Exceptional handling of light and emotion.");
  ensureJudgeScore(sp1, teacher2Id, "Best", "Technically flawless and deeply moving.");
  ensureJudgeScore(sp2, teacher1Id, "Better", "Strong color theory, composition could be tighter.");
  ensureJudgeScore(sp2, teacher2Id, "Good", "Nice mood, brushwork needs refinement.");
  ensureJudgeScore(sp3, teacher1Id, "Good", "Solid likeness, background feels unfinished.");
  ensureJudgeScore(sp3, teacher2Id, "Better", "Great character study.");
  ensureJudgeScore(sp4, teacher1Id, "Moderate", "Good attempt at a double portrait, proportions need work.");
  ensureJudgeScore(sp4, teacher2Id, "Moderate", "Agreed — keep practicing double compositions.");
  ensureJudgeScore(sp5, teacher1Id, "Normal", "Basic execution, needs more study of anatomy.");
  ensureJudgeScore(sp5, teacher2Id, "Moderate", "Some nice tonal work despite the rough anatomy.");

  ensureAward({ competitionId: compSpring, submissionId: sp1, studentId: studentIds["student"], awardName: "Best in Show", description: "Unanimous top score from both judges." });
  ensureAward({ competitionId: compSpring, submissionId: sp3, studentId: studentIds["hung.le"], awardName: "2nd Place", description: "Strong character study." });
  ensureAward({ competitionId: compSpring, submissionId: sp2, studentId: studentIds["lan.nguyen"], awardName: "3rd Place", description: "Excellent color theory." });

  // Summer Landscape Sprint (closed) — fully judged, feeds awards + a second exhibition
  const su1 = ensureSubmission({ competitionId: compSummer, studentId: studentIds["huong.vu"], title: "Rice Terraces at Dawn", assetFilename: "painting-06.jpg", description: "Sapa terraces painted just after sunrise.", submittedAt: "2026-04-10 08:00:00" });
  const su2 = ensureSubmission({ competitionId: compSummer, studentId: studentIds["tuan.dang"], title: "Harbor at Dusk", assetFilename: "painting-07.jpg", description: "Fishing boats returning at dusk.", submittedAt: "2026-04-15 17:20:00" });
  const su3 = ensureSubmission({ competitionId: compSummer, studentId: studentIds["ngoc.bui"], title: "Mountain Mist", assetFilename: "painting-08.jpg", description: "Layers of fog over distant peaks.", submittedAt: "2026-04-20 12:10:00" });
  const su4 = ensureSubmission({ competitionId: compSummer, studentId: studentIds["phuc.do"], title: "Golden Wheat Field", assetFilename: "painting-09.jpg", description: "A field of wheat under the summer sun.", submittedAt: "2026-04-25 15:00:00" });

  ensureJudgeScore(su1, teacher1Id, "Best", "Gorgeous light, masterful use of gradients.");
  ensureJudgeScore(su1, teacher2Id, "Better", "Beautiful piece, a touch more contrast would elevate it further.");
  ensureJudgeScore(su2, teacher1Id, "Good", "Nice atmosphere and color harmony.");
  ensureJudgeScore(su2, teacher2Id, "Good", "Agreed, solid composition.");
  ensureJudgeScore(su3, teacher1Id, "Better", "Lovely handling of atmospheric perspective.");
  ensureJudgeScore(su3, teacher2Id, "Best", "One of the strongest pieces this term.");
  ensureJudgeScore(su4, teacher1Id, "Moderate", "Good color choice, composition feels a bit flat.");
  ensureJudgeScore(su4, teacher2Id, "Good", "I liked the texture work more than judge 1 did.");

  ensureAward({ competitionId: compSummer, submissionId: su3, studentId: studentIds["ngoc.bui"], awardName: "Best in Show", description: "Outstanding atmospheric perspective." });
  ensureAward({ competitionId: compSummer, submissionId: su1, studentId: studentIds["huong.vu"], awardName: "Honorable Mention", description: "Exceptional light rendering." });

  // Autumn Watercolor Contest (ongoing) — partially judged, demonstrates the live/in-progress state
  const au1 = ensureSubmission({ competitionId: compAutumn, studentId: studentIds["student"], title: "Maple Path", assetFilename: "painting-10.jpg", description: "A quiet path lined with maple trees.", submittedAt: "2026-07-05 10:00:00" });
  const au2 = ensureSubmission({ competitionId: compAutumn, studentId: studentIds["lan.nguyen"], title: "Harvest Basket", assetFilename: "painting-11.jpg", description: "Still life of an autumn harvest.", submittedAt: "2026-07-10 13:00:00" });
  const au3 = ensureSubmission({ competitionId: compAutumn, studentId: studentIds["thu.ngo"], title: "First Frost", assetFilename: "painting-12.jpg", description: "The first frost of the season on fallen leaves.", submittedAt: "2026-07-15 09:30:00" });

  ensureJudgeScore(au1, teacher1Id, "Better", "Lovely warm palette, keep it up.");
  // au1 intentionally left unscored by teacher2 — demoes "not yet scored by me" filter
  ensureJudgeScore(au2, teacher1Id, "Good", "Nice composition.");
  ensureJudgeScore(au2, teacher2Id, "Better", "Agreed, and the lighting is well handled.");
  // au3 intentionally left completely unscored — demoes the "unmarked" filter and the new-submission realtime event

  // Ink Wash Masters (ongoing) — fresh, unscored submission
  ensureSubmission({ competitionId: compInkWash, studentId: studentIds["hung.le"], title: "Bamboo in Mist", assetFilename: "painting-01.jpg", description: "Traditional ink wash study of bamboo.", submittedAt: "2026-07-16 11:00:00" });

  // ----------------------- EXHIBITIONS -----------------------

  const exSpring = ensureExhibition({
    title: "Spring Portraits Exhibition", description: "Featuring the best portraits from the Spring Portrait Challenge.",
    location: "Main Gallery", start_date: "2026-03-20", end_date: "2026-04-10", created_by: teacher1Id,
  });
  ensureExhibitionPainting({ exhibitionId: exSpring, submissionId: sp1, askingPrice: 300, status: "sold", soldPrice: 350, customerName: "Mrs. Kim Anh", paidToStudent: true });
  ensureExhibitionPainting({ exhibitionId: exSpring, submissionId: sp3, askingPrice: 220, status: "sold", soldPrice: 220, customerName: "Mr. Duong", paidToStudent: false });
  ensureExhibitionPainting({ exhibitionId: exSpring, submissionId: sp2, askingPrice: 180, status: "returned" });

  const exSummer = ensureExhibition({
    title: "Summer Colors Showcase", description: "Landscape works from the Summer Landscape Sprint.",
    location: "East Wing Gallery", start_date: "2026-06-15", end_date: "2026-08-01", created_by: teacher2Id,
  });
  ensureExhibitionPainting({ exhibitionId: exSummer, submissionId: su3, askingPrice: 400, status: "sold", soldPrice: 450, customerName: "Ha Long Collectors Club", paidToStudent: true });
  ensureExhibitionPainting({ exhibitionId: exSummer, submissionId: su1, askingPrice: 320, status: "on_display" });
  ensureExhibitionPainting({ exhibitionId: exSummer, submissionId: su2, askingPrice: 260, status: "on_display" });

  ensureExhibition({
    title: "Autumn Preview Exhibition", description: "An upcoming showcase for this season's strongest autumn entries.",
    location: "Main Gallery", start_date: "2027-01-05", end_date: "2027-01-25", created_by: adminId,
  });

  console.log("Seed complete — full demo data set created:");
  console.log("  10 students, 2 staff judges, 1 manager, 1 admin");
  console.log("  6 competitions (2 ongoing, 2 closed, 2 upcoming)");
  console.log("  13 submissions, multi-judge scored across closed/ongoing contests");
  console.log("  5 awards, 3 exhibitions (2 with sales history, 1 upcoming/empty)");
  console.log("");
  console.log("  admin      / admin123");
  console.log("  manager    / manager123");
  console.log("  teacher    / teacher123   (staff, judge #1)");
  console.log("  teacher2   / teacher123   (staff, judge #2)");
  console.log("  student    / student123   (+ 9 more student accounts, all password student123 —");
  console.log("                             see Admin -> Student Accounts, or seed.js, for the full list)");
});

tx();
