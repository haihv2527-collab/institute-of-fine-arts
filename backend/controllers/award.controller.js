const db = require("../config/db");

// GET /api/awards?competition_id=
function listAwards(req, res) {
  const { competition_id } = req.query;
  let sql = `
    SELECT a.*, u.full_name AS student_name, c.title AS competition_title
    FROM awards a
    JOIN students st ON st.id = a.student_id
    JOIN users u ON u.id = st.user_id
    JOIN competitions c ON c.id = a.competition_id
    WHERE 1 = 1`;
  const params = [];

  if (competition_id) {
    sql += " AND a.competition_id = ?";
    params.push(competition_id);
  }
  if (req.user.role === "student") {
    sql += " AND st.user_id = ?";
    params.push(req.user.id);
  }

  sql += " ORDER BY a.created_at DESC";
  res.json(db.prepare(sql).all(...params));
}

// GET /api/awards/recent?limit=5  (used on the public home page)
function recentAwards(req, res) {
  const limit = Number(req.query.limit) || 5;
  const rows = db
    .prepare(
      `SELECT a.id, a.award_name, a.created_at, u.full_name AS student_name, c.title AS competition_title
       FROM awards a
       JOIN students st ON st.id = a.student_id
       JOIN users u ON u.id = st.user_id
       JOIN competitions c ON c.id = a.competition_id
       ORDER BY a.created_at DESC LIMIT ?`
    )
    .all(limit);
  res.json(rows);
}

// POST /api/awards  (staff only)
function createAward(req, res) {
  const { competition_id, submission_id, student_id, award_name, description } = req.body;
  if (!competition_id || !student_id || !award_name) {
    return res.status(400).json({ message: "competition_id, student_id and award_name are required." });
  }

  const result = db
    .prepare(
      `INSERT INTO awards (competition_id, submission_id, student_id, award_name, description)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(competition_id, submission_id || null, student_id, award_name, description || null);

  res.status(201).json({ message: "Award created.", id: result.lastInsertRowid });
}

// PUT /api/awards/:id  (staff only)
function updateAward(req, res) {
  const { award_name, description } = req.body;
  db.prepare(
    "UPDATE awards SET award_name = COALESCE(?, award_name), description = COALESCE(?, description) WHERE id = ?"
  ).run(award_name, description, req.params.id);
  res.json({ message: "Award updated." });
}

// DELETE /api/awards/:id  (staff only)
function deleteAward(req, res) {
  const result = db.prepare("DELETE FROM awards WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Award not found." });
  res.json({ message: "Award deleted." });
}

module.exports = { listAwards, recentAwards, createAward, updateAward, deleteAward };
