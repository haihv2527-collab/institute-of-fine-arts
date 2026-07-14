const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const VALID_MARKS = ["Best", "Better", "Good", "Moderate", "Normal", "Disqualified"];

function getStudentIdForUser(userId) {
  const row = db.prepare("SELECT id FROM students WHERE user_id = ?").get(userId);
  return row ? row.id : null;
}

function isPastDeadline(competition) {
  const today = new Date().toISOString().slice(0, 10);
  return today > competition.end_date;
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
    SELECT s.*, u.full_name AS student_name, c.title AS competition_title, c.end_date
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

// PATCH /api/submissions/:id/mark  (staff only)
function markSubmission(req, res) {
  const { mark, remark } = req.body;

  if (!VALID_MARKS.includes(mark)) {
    return res.status(400).json({ message: `mark must be one of: ${VALID_MARKS.join(", ")}` });
  }

  const existing = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Submission not found." });

  db.prepare(
    `UPDATE submissions SET mark = ?, remark = ?, marked_by = ?, marked_at = datetime('now') WHERE id = ?`
  ).run(mark, remark || null, req.user.id, req.params.id);

  res.json({ message: "Submission marked." });
}

module.exports = {
  createSubmission, listSubmissions, getSubmission,
  updateSubmission, deleteSubmission, markSubmission, VALID_MARKS,
};
