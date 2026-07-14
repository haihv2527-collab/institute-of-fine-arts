const db = require("../config/db");

// Automatically derive status from today's date vs start/end date
function computeStatus(start_date, end_date) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < start_date) return "upcoming";
  if (today > end_date) return "closed";
  return "ongoing";
}

// GET /api/competitions?status=upcoming|ongoing|closed
function listCompetitions(req, res) {
  const { status } = req.query;
  const rows = db.prepare("SELECT * FROM competitions ORDER BY start_date DESC").all();

  // Keep stored status in sync with real dates before returning
  const withComputed = rows.map((c) => ({ ...c, status: computeStatus(c.start_date, c.end_date) }));
  const filtered = status ? withComputed.filter((c) => c.status === status) : withComputed;
  res.json(filtered);
}

// GET /api/competitions/:id
function getCompetition(req, res) {
  const row = db.prepare("SELECT * FROM competitions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ message: "Competition not found." });
  row.status = computeStatus(row.start_date, row.end_date);

  const submissionCount = db
    .prepare("SELECT COUNT(*) AS n FROM submissions WHERE competition_id = ?")
    .get(req.params.id).n;

  res.json({ ...row, submission_count: submissionCount });
}

// POST /api/competitions  (staff only)
function createCompetition(req, res) {
  const { title, description, conditions, prize, start_date, end_date } = req.body;
  if (!title || !start_date || !end_date) {
    return res.status(400).json({ message: "title, start_date and end_date are required." });
  }
  if (start_date > end_date) {
    return res.status(400).json({ message: "start_date must be before end_date." });
  }

  const result = db
    .prepare(
      `INSERT INTO competitions (title, description, conditions, prize, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, description || null, conditions || null, prize || null, start_date, end_date,
      computeStatus(start_date, end_date), req.user.id);

  res.status(201).json({ message: "Competition created.", id: result.lastInsertRowid });
}

// PUT /api/competitions/:id  (staff only)
function updateCompetition(req, res) {
  const { title, description, conditions, prize, start_date, end_date } = req.body;
  const existing = db.prepare("SELECT * FROM competitions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Competition not found." });

  const newStart = start_date || existing.start_date;
  const newEnd = end_date || existing.end_date;

  db.prepare(
    `UPDATE competitions SET title = COALESCE(?, title), description = COALESCE(?, description),
     conditions = COALESCE(?, conditions), prize = COALESCE(?, prize),
     start_date = ?, end_date = ?, status = ? WHERE id = ?`
  ).run(title, description, conditions, prize, newStart, newEnd, computeStatus(newStart, newEnd), req.params.id);

  res.json({ message: "Competition updated." });
}

// DELETE /api/competitions/:id  (staff only)
function deleteCompetition(req, res) {
  const result = db.prepare("DELETE FROM competitions WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Competition not found." });
  res.json({ message: "Competition deleted." });
}

module.exports = { listCompetitions, getCompetition, createCompetition, updateCompetition, deleteCompetition, computeStatus };
