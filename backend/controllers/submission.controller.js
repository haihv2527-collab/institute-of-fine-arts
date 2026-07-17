const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const { notifyUser, notifyRole } = require("../realtime/socket");
const { sendMail, templates } = require("../utils/mailer");

const VALID_MARKS = ["Best", "Better", "Good", "Moderate", "Normal", "Disqualified"];

// Numeric scale used only to average multiple judges' marks into one
// aggregate bucket. Disqualified is handled separately below (a single
// disqualifying judge overrides the whole submission — see recomputeAggregate).
const MARK_POINTS = { Normal: 1, Moderate: 2, Good: 3, Better: 4, Best: 5 };
const POINT_TO_MARK = { 1: "Normal", 2: "Moderate", 3: "Good", 4: "Better", 5: "Best" };

function getStudentIdForUser(userId) {
  const row = db.prepare("SELECT id FROM students WHERE user_id = ?").get(userId);
  return row ? row.id : null;
}

function isPastDeadline(competition) {
  const today = new Date().toISOString().slice(0, 10);
  return today > competition.end_date;
}

/** Full name + email of the student who owns a submission — used for email/socket notifications. */
function getSubmissionOwner(submissionId) {
  return db
    .prepare(
      `SELECT u.id AS user_id, u.full_name, u.email
       FROM submissions s
       JOIN students st ON st.id = s.student_id
       JOIN users u ON u.id = st.user_id
       WHERE s.id = ?`
    )
    .get(submissionId);
}

/**
 * Recalculates a submission's cached mark/remark from every judge_scores
 * row belonging to it, then writes the result back onto the submissions
 * table so existing reads (filters, exhibition selection, home page,
 * etc.) keep working unchanged against a single "mark" column.
 *
 * Rule: if ANY judge marked the piece Disqualified, the whole submission
 * is Disqualified — otherwise the aggregate is the rounded average of
 * every judge's mark, converted back to the nearest label.
 */
function recomputeAggregate(submissionId) {
  const scores = db
    .prepare(
      `SELECT js.mark, js.remark, u.full_name AS judge_name
       FROM judge_scores js
       JOIN users u ON u.id = js.judge_id
       WHERE js.submission_id = ?
       ORDER BY js.created_at ASC`
    )
    .all(submissionId);

  if (scores.length === 0) {
    db.prepare("UPDATE submissions SET mark = NULL, remark = NULL, marked_by = NULL, marked_at = NULL WHERE id = ?")
      .run(submissionId);
    return { mark: null, remark: null };
  }

  let aggregateMark;
  if (scores.some((s) => s.mark === "Disqualified")) {
    aggregateMark = "Disqualified";
  } else {
    const avg = scores.reduce((sum, s) => sum + MARK_POINTS[s.mark], 0) / scores.length;
    const rounded = Math.min(5, Math.max(1, Math.round(avg)));
    aggregateMark = POINT_TO_MARK[rounded];
  }

  const combinedRemark = scores
    .filter((s) => s.remark)
    .map((s) => `${s.judge_name} (${s.mark}): ${s.remark}`)
    .join(" | ") || null;

  db.prepare(
    `UPDATE submissions SET mark = ?, remark = ?, marked_at = datetime('now') WHERE id = ?`
  ).run(aggregateMark, combinedRemark, submissionId);

  return { mark: aggregateMark, remark: combinedRemark };
}

// POST /api/submissions  (student only, multipart/form-data with "painting" file)
function createSubmission(req, res) {
  const { competition_id, title, description, quote } = req.body;

  if (!competition_id || !req.file) {
    return res.status(400).json({ message: "competition_id and a JPEG painting file are required." });
  }

  const competition = db.prepare("SELECT * FROM competitions WHERE id = ?").get(competition_id);
  if (!competition) {
    fs.unlink(req.file.path, () => {});
    return res.status(404).json({ message: "Competition not found." });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (today < competition.start_date) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "This competition has not started yet." });
  }
  if (isPastDeadline(competition)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "Submission deadline has passed for this competition." });
  }

  const studentId = getStudentIdForUser(req.user.id);
  if (!studentId) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "No student profile linked to this account." });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO submissions (competition_id, student_id, title, image_path, description, quote)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(competition_id, studentId, title || null, req.file.filename, description || null, quote || null);

    // Let every connected staff member know a fresh painting is waiting to be judged.
    notifyRole("staff", "submission:new", {
      submissionId: result.lastInsertRowid,
      competitionTitle: competition.title,
      studentName: req.user.full_name,
    });

    res.status(201).json({ message: "Painting submitted successfully.", id: result.lastInsertRowid });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ message: "Could not save submission. " + err.message });
  }
}

// GET /api/submissions?competition_id=&student_id=&mark=
function listSubmissions(req, res) {
  const { competition_id, student_id, mark } = req.query;
  let sql = `
    SELECT s.*, u.full_name AS student_name, c.title AS competition_title, c.end_date,
           (SELECT COUNT(*) FROM judge_scores js WHERE js.submission_id = s.id) AS judge_count
    FROM submissions s
    JOIN students st ON st.id = s.student_id
    JOIN users u ON u.id = st.user_id
    JOIN competitions c ON c.id = s.competition_id
    WHERE 1 = 1`;
  const params = [];

  // Students may only see their own submissions
  if (req.user.role === "student") {
    sql += " AND s.student_id = ?";
    params.push(getStudentIdForUser(req.user.id));
  } else if (student_id) {
    sql += " AND s.student_id = ?";
    params.push(student_id);
  }

  if (competition_id) {
    sql += " AND s.competition_id = ?";
    params.push(competition_id);
  }
  if (mark) {
    sql += " AND s.mark = ?";
    params.push(mark);
  }

  sql += " ORDER BY s.submitted_at DESC";
  res.json(db.prepare(sql).all(...params));
}

// GET /api/submissions/:id
function getSubmission(req, res) {
  const row = db
    .prepare(
      `SELECT s.*, u.full_name AS student_name, c.title AS competition_title
       FROM submissions s
       JOIN students st ON st.id = s.student_id
       JOIN users u ON u.id = st.user_id
       JOIN competitions c ON c.id = s.competition_id
       WHERE s.id = ?`
    )
    .get(req.params.id);

  if (!row) return res.status(404).json({ message: "Submission not found." });

  if (req.user.role === "student" && row.student_id !== getStudentIdForUser(req.user.id)) {
    return res.status(403).json({ message: "Access denied." });
  }
  res.json(row);
}

// PUT /api/submissions/:id  (student only, before deadline, own submission)
function updateSubmission(req, res) {
  const existing = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Submission not found." });

  if (existing.student_id !== getStudentIdForUser(req.user.id)) {
    return res.status(403).json({ message: "You can only edit your own submissions." });
  }

  const competition = db.prepare("SELECT * FROM competitions WHERE id = ?").get(existing.competition_id);
  if (isPastDeadline(competition)) {
    return res.status(400).json({ message: "Cannot edit — submission deadline has passed." });
  }

  const { title, description, quote } = req.body;
  let newImagePath = existing.image_path;

  if (req.file) {
    newImagePath = req.file.filename;
    const oldFilePath = path.join(path.dirname(req.file.path), existing.image_path);
    fs.unlink(oldFilePath, () => {});
  }

  db.prepare(
    `UPDATE submissions SET title = COALESCE(?, title), description = COALESCE(?, description),
     quote = COALESCE(?, quote), image_path = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title, description, quote, newImagePath, req.params.id);

  res.json({ message: "Submission updated." });
}

// DELETE /api/submissions/:id  (student only, before deadline, own submission)
function deleteSubmission(req, res) {
  const existing = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Submission not found." });

  if (existing.student_id !== getStudentIdForUser(req.user.id)) {
    return res.status(403).json({ message: "You can only delete your own submissions." });
  }

  const competition = db.prepare("SELECT * FROM competitions WHERE id = ?").get(existing.competition_id);
  if (isPastDeadline(competition)) {
    return res.status(400).json({ message: "Cannot delete — submission deadline has passed." });
  }

  db.prepare("DELETE FROM submissions WHERE id = ?").run(req.params.id);

  const { UPLOAD_DIR } = require("../middleware/upload.middleware");
  fs.unlink(path.join(UPLOAD_DIR, existing.image_path), () => {});

  res.json({ message: "Submission deleted." });
}

// ----------------------- MULTI-JUDGE SCORING -----------------------

// GET /api/submissions/:id/scores — every judge's individual mark + remark
function listJudgeScores(req, res) {
  const submission = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found." });

  if (req.user.role === "student" && submission.student_id !== getStudentIdForUser(req.user.id)) {
    return res.status(403).json({ message: "Access denied." });
  }

  const scores = db
    .prepare(
      `SELECT js.id, js.mark, js.remark, js.created_at, js.updated_at,
              js.judge_id, u.full_name AS judge_name
       FROM judge_scores js
       JOIN users u ON u.id = js.judge_id
       WHERE js.submission_id = ?
       ORDER BY js.created_at ASC`
    )
    .all(req.params.id);

  res.json({
    aggregate_mark: submission.mark,
    judge_count: scores.length,
    scores,
  });
}

// POST /api/submissions/:id/scores  (staff only) — create or update *your own* score
function upsertJudgeScore(req, res) {
  const { mark, remark } = req.body;

  if (!VALID_MARKS.includes(mark)) {
    return res.status(400).json({ message: `mark must be one of: ${VALID_MARKS.join(", ")}` });
  }

  const submission = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!submission) return res.status(404).json({ message: "Submission not found." });

  db.prepare(
    `INSERT INTO judge_scores (submission_id, judge_id, mark, remark)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(submission_id, judge_id)
     DO UPDATE SET mark = excluded.mark, remark = excluded.remark, updated_at = datetime('now')`
  ).run(req.params.id, req.user.id, mark, remark || null);

  const { mark: aggregateMark, remark: aggregateRemark } = recomputeAggregate(req.params.id);

  const owner = getSubmissionOwner(req.params.id);
  if (owner) {
    notifyUser(owner.user_id, "submission:scored", {
      submissionId: Number(req.params.id),
      competitionTitle: submission.competition_title,
      judgeName: req.user.full_name,
      mark,
      remark: remark || null,
      aggregateMark,
    });

    const tmpl = templates.submissionScored({
      studentName: owner.full_name,
      competitionTitle: db.prepare("SELECT title FROM competitions WHERE id = ?").get(submission.competition_id)?.title || "",
      judgeName: req.user.full_name,
      mark,
      remark,
      paintingTitle: submission.title,
    });
    sendMail({ to: owner.email, ...tmpl });
  }

  res.json({ message: "Score saved.", aggregate_mark: aggregateMark, aggregate_remark: aggregateRemark });
}

// DELETE /api/submissions/:id/scores  (staff only) — remove your own score
function deleteMyJudgeScore(req, res) {
  const result = db
    .prepare("DELETE FROM judge_scores WHERE submission_id = ? AND judge_id = ?")
    .run(req.params.id, req.user.id);

  if (result.changes === 0) return res.status(404).json({ message: "You haven't scored this submission." });

  const { mark: aggregateMark } = recomputeAggregate(req.params.id);
  res.json({ message: "Your score was removed.", aggregate_mark: aggregateMark });
}

module.exports = {
  createSubmission, listSubmissions, getSubmission,
  updateSubmission, deleteSubmission,
  listJudgeScores, upsertJudgeScore, deleteMyJudgeScore,
  VALID_MARKS,
};
