const db = require("../config/db");
const { notifyUser } = require("../realtime/socket");
const { sendMail, templates } = require("../utils/mailer");

function computeStatus(start_date, end_date) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < start_date) return "upcoming";
  if (today > end_date) return "closed";
  return "ongoing";
}

// ----------------------- EXHIBITIONS -----------------------

// GET /api/exhibitions?status=
function listExhibitions(req, res) {
  const { status } = req.query;
  const rows = db.prepare("SELECT * FROM exhibitions ORDER BY start_date DESC").all()
    .map((e) => ({ ...e, status: computeStatus(e.start_date, e.end_date) }));
  res.json(status ? rows.filter((e) => e.status === status) : rows);
}

// GET /api/exhibitions/:id
function getExhibition(req, res) {
  const row = db.prepare("SELECT * FROM exhibitions WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ message: "Exhibition not found." });
  row.status = computeStatus(row.start_date, row.end_date);
  res.json(row);
}

// POST /api/exhibitions  (staff only)
function createExhibition(req, res) {
  const { title, description, location, start_date, end_date } = req.body;
  if (!title || !start_date || !end_date) {
    return res.status(400).json({ message: "title, start_date and end_date are required." });
  }

  const result = db
    .prepare(
      `INSERT INTO exhibitions (title, description, location, start_date, end_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(title, description || null, location || null, start_date, end_date,
      computeStatus(start_date, end_date), req.user.id);

  res.status(201).json({ message: "Exhibition created.", id: result.lastInsertRowid });
}

// PUT /api/exhibitions/:id  (staff only)
function updateExhibition(req, res) {
  const existing = db.prepare("SELECT * FROM exhibitions WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ message: "Exhibition not found." });

  const { title, description, location, start_date, end_date } = req.body;
  const newStart = start_date || existing.start_date;
  const newEnd = end_date || existing.end_date;

  db.prepare(
    `UPDATE exhibitions SET title = COALESCE(?, title), description = COALESCE(?, description),
     location = COALESCE(?, location), start_date = ?, end_date = ?, status = ? WHERE id = ?`
  ).run(title, description, location, newStart, newEnd, computeStatus(newStart, newEnd), req.params.id);

  res.json({ message: "Exhibition updated." });
}

// DELETE /api/exhibitions/:id  (staff only)
function deleteExhibition(req, res) {
  const result = db.prepare("DELETE FROM exhibitions WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ message: "Exhibition not found." });
  res.json({ message: "Exhibition deleted." });
}

// ----------------------- EXHIBITION PAINTINGS -----------------------

// GET /api/exhibitions/:id/paintings
function listExhibitionPaintings(req, res) {
  const rows = db
    .prepare(
      `SELECT ep.*, s.title AS painting_title, s.image_path, s.description, u.full_name AS student_name,
              st.user_id AS student_user_id
       FROM exhibition_paintings ep
       JOIN submissions s ON s.id = ep.submission_id
       JOIN students st ON st.id = s.student_id
       JOIN users u ON u.id = st.user_id
       WHERE ep.exhibition_id = ?
       ORDER BY ep.id DESC`
    )
    .all(req.params.id);

  // Students only see their own paintings' exhibition status
  if (req.user.role === "student") {
    return res.json(rows.filter((r) => r.student_user_id === req.user.id));
  }
  res.json(rows);
}

// POST /api/exhibitions/:id/paintings  (staff only) — add a submission to an exhibition
function addPaintingToExhibition(req, res) {
  const { submission_id, asking_price } = req.body;
  if (!submission_id) return res.status(400).json({ message: "submission_id is required." });

  try {
    const result = db
      .prepare(
        `INSERT INTO exhibition_paintings (exhibition_id, submission_id, asking_price)
         VALUES (?, ?, ?)`
      )
      .run(req.params.id, submission_id, asking_price || null);
    res.status(201).json({ message: "Painting added to exhibition.", id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ message: "Could not add painting. " + err.message });
  }
}

// PATCH /api/exhibitions/paintings/:paintingId  (staff only) — update sale status
function updateExhibitionPainting(req, res) {
  const { asking_price, status, sold_price, customer_name, customer_contact, paid_to_student } = req.body;

  const existing = db.prepare("SELECT * FROM exhibition_paintings WHERE id = ?").get(req.params.paintingId);
  if (!existing) return res.status(404).json({ message: "Exhibition painting not found." });

  const soldAt = status === "sold" && existing.status !== "sold" ? new Date().toISOString() : existing.sold_at;

  db.prepare(
    `UPDATE exhibition_paintings SET
       asking_price = COALESCE(?, asking_price),
       status = COALESCE(?, status),
       sold_price = COALESCE(?, sold_price),
       customer_name = COALESCE(?, customer_name),
       customer_contact = COALESCE(?, customer_contact),
       paid_to_student = COALESCE(?, paid_to_student),
       sold_at = ?
     WHERE id = ?`
  ).run(asking_price, status, sold_price, customer_name, customer_contact, paid_to_student, soldAt, req.params.paintingId);

  const justSold = status === "sold" && existing.status !== "sold";
  if (justSold) {
    const info = db
      .prepare(
        `SELECT u.id AS user_id, u.full_name, u.email, s.title AS painting_title, e.title AS exhibition_title
         FROM exhibition_paintings ep
         JOIN submissions s ON s.id = ep.submission_id
         JOIN students st ON st.id = s.student_id
         JOIN users u ON u.id = st.user_id
         JOIN exhibitions e ON e.id = ep.exhibition_id
         WHERE ep.id = ?`
      )
      .get(req.params.paintingId);

    if (info) {
      notifyUser(info.user_id, "exhibition:sold", {
        paintingId: Number(req.params.paintingId),
        paintingTitle: info.painting_title,
        exhibitionTitle: info.exhibition_title,
        soldPrice: sold_price ?? existing.sold_price,
      });

      const tmpl = templates.paintingSold({
        studentName: info.full_name,
        paintingTitle: info.painting_title,
        exhibitionTitle: info.exhibition_title,
        soldPrice: sold_price ?? existing.sold_price,
      });
      sendMail({ to: info.email, ...tmpl });
    }
  }

  res.json({ message: "Exhibition painting updated." });
}

// DELETE /api/exhibitions/paintings/:paintingId  (staff only)
function removePaintingFromExhibition(req, res) {
  const result = db.prepare("DELETE FROM exhibition_paintings WHERE id = ?").run(req.params.paintingId);
  if (result.changes === 0) return res.status(404).json({ message: "Exhibition painting not found." });
  res.json({ message: "Painting removed from exhibition." });
}

module.exports = {
  listExhibitions, getExhibition, createExhibition, updateExhibition, deleteExhibition,
  listExhibitionPaintings, addPaintingToExhibition, updateExhibitionPainting, removePaintingFromExhibition,
};
