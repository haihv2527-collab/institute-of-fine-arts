renderHeader();

function competitionCard(c) {
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <span class="tag ${c.status}">${c.status}</span>
      <h3 style="margin-top:10px;">${escapeHtml(c.title)}</h3>
      <p>${escapeHtml(c.description || "No description provided.")}</p>
      <div class="label">
        <span>${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}</span>
        ${c.submission_count !== undefined ? `<span>${c.submission_count} entries</span>` : ""}
      </div>
    </div>
  `;
}

function winnerCard(w) {
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <span class="tag mark-Best">${escapeHtml(w.award_name)}</span>
      <h3 style="margin-top:10px;">${escapeHtml(w.student_name)}</h3>
      <p>${escapeHtml(w.competition_title)}</p>
      <div class="label"><span>${fmtDate(w.created_at)}</span></div>
    </div>
  `;
}

async function load() {
  try {
    const data = await api.get("/home/summary");

    document.getElementById("hero-stats").innerHTML = `
      <div class="stat"><div class="num">${data.ongoing_competitions.length}</div><div class="cap">Ongoing now</div></div>
      <div class="stat"><div class="num">${data.upcoming_competitions.length}</div><div class="cap">Upcoming</div></div>
      <div class="stat"><div class="num">${data.recent_winners.length}</div><div class="cap">Recent winners</div></div>
    `;

    document.getElementById("ongoing-count").textContent = `(${data.ongoing_competitions.length})`;
    document.getElementById("ongoing-grid").innerHTML = data.ongoing_competitions.length
      ? data.ongoing_competitions.map(competitionCard).join("")
      : `<div class="empty-state">No competitions are running right now — check back soon.</div>`;

    document.getElementById("upcoming-count").textContent = `(${data.upcoming_competitions.length})`;
    document.getElementById("upcoming-grid").innerHTML = data.upcoming_competitions.length
      ? data.upcoming_competitions.map(competitionCard).join("")
      : `<div class="empty-state">No upcoming competitions have been announced yet.</div>`;

    document.getElementById("winners-count").textContent = `(${data.recent_winners.length})`;
    document.getElementById("winners-grid").innerHTML = data.recent_winners.length
      ? data.recent_winners.map(winnerCard).join("")
      : `<div class="empty-state">Awards will appear here once a competition concludes.</div>`;
  } catch (err) {
    toast(err.message, true);
  }
}

load();
