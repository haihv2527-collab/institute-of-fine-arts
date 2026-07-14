const db = require("../config/db");
const { computeStatus } = require("./competition.controller");

// GET /api/home/summary — everything the public Home Page needs in one call
function homeSummary(req, res) {
  const all = db.prepare("SELECT * FROM competitions ORDER BY start_date DESC").all()
    .map((c) => ({ ...c, status: computeStatus(c.start_date, c.end_date) }));

  const upcoming = all.filter((c) => c.status === "upcoming").slice(0, 6);
  const ongoing = all.filter((c) => c.status === "ongoing");

  const ongoingWithCounts = ongoing.map((c) => ({
    ...c,
    submission_count: db
      .prepare("SELECT COUNT(*) AS n FROM submissions WHERE competition_id = ?")
      .get(c.id).n,
  }));

  const recentWinners = db
    .prepare(
      `SELECT a.id, a.award_name, a.created_at, u.full_name AS student_name, c.title AS competition_title
       FROM awards a
       JOIN students st ON st.id = a.student_id
       JOIN users u ON u.id = st.user_id
       JOIN competitions c ON c.id = a.competition_id
       ORDER BY a.created_at DESC LIMIT 6`
    )
    .all();

  res.json({
    upcoming_competitions: upcoming,
    ongoing_competitions: ongoingWithCounts,
    recent_winners: recentWinners,
  });
}

module.exports = { homeSummary };
