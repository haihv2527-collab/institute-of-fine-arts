const db = require("../config/db");

// GET /api/manager/overview — high level counts for the manager dashboard
function overview(req, res) {
  const counts = {
    students: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'student'").get().n,
    staff: db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'staff'").get().n,
    competitions: db.prepare("SELECT COUNT(*) AS n FROM competitions").get().n,
    submissions: db.prepare("SELECT COUNT(*) AS n FROM submissions").get().n,
    awards: db.prepare("SELECT COUNT(*) AS n FROM awards").get().n,
    exhibitions: db.prepare("SELECT COUNT(*) AS n FROM exhibitions").get().n,
    paintings_sold: db.prepare("SELECT COUNT(*) AS n FROM exhibition_paintings WHERE status = 'sold'").get().n,
  };
  res.json(counts);
}

// GET /api/manager/reports/best-submissions?competition_id=
function bestSubmissionsReport(req, res) {
  const { competition_id } = req.query;
  let sql = `
    SELECT s.id, s.title, s.mark, s.remark, s.submitted_at, s.image_path,
           u.full_name AS student_name, c.title AS competition_title, c.start_date, c.end_date
    FROM submissions s
    JOIN students st ON st.id = s.student_id
    JOIN users u ON u.id = st.user_id
    JOIN competitions c ON c.id = s.competition_id
    WHERE s.mark = 'Best'`;
  const params = [];
  if (competition_id) {
    sql += " AND s.competition_id = ?";
    params.push(competition_id);
  }
  sql += " ORDER BY s.submitted_at DESC";
  res.json(db.prepare(sql).all(...params));
}

// GET /api/manager/reports/exhibition-sales
function exhibitionSalesReport(req, res) {
  const rows = db
    .prepare(
      `SELECT ep.*, e.title AS exhibition_title, s.title AS painting_title, u.full_name AS student_name
       FROM exhibition_paintings ep
       JOIN exhibitions e ON e.id = ep.exhibition_id
       JOIN submissions s ON s.id = ep.submission_id
       JOIN students st ON st.id = s.student_id
       JOIN users u ON u.id = st.user_id
       WHERE ep.status = 'sold'
       ORDER BY ep.sold_at DESC`
    )
    .all();
  res.json(rows);
}

// GET /api/manager/remarks?competition_id=  — every staff remark, for oversight
function remarksReport(req, res) {
  const { competition_id } = req.query;
  let sql = `
    SELECT s.id, s.remark, s.mark, s.marked_at, u.full_name AS student_name,
           marker.full_name AS marked_by_name, c.title AS competition_title
    FROM submissions s
    JOIN students st ON st.id = s.student_id
    JOIN users u ON u.id = st.user_id
    JOIN competitions c ON c.id = s.competition_id
    LEFT JOIN users marker ON marker.id = s.marked_by
    WHERE s.remark IS NOT NULL`;
  const params = [];
  if (competition_id) {
    sql += " AND s.competition_id = ?";
    params.push(competition_id);
  }
  sql += " ORDER BY s.marked_at DESC";
  res.json(db.prepare(sql).all(...params));
}

module.exports = { overview, bestSubmissionsReport, exhibitionSalesReport, remarksReport };
