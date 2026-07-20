const currentUser = Auth.guard(["staff"]);
renderHeader();
renderDashShell({ role: "staff", active: "/staff/submissions.html", title: "Judge Submissions" });

const MARKS = ["Best", "Better", "Good", "Moderate", "Normal", "Disqualified"];
const PAGE_SIZE = 3; // small on purpose so pagination is visible with the seeded demo data
let competitions = [];
let currentPage = 1;
let lastKnownSubmissions = []; // cache of the current page's rows, used by the score modal

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal"><button class="close-x" onclick="closeModal()">&times;</button>${innerHtml}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { const el = document.querySelector(".modal-backdrop"); if (el) el.remove(); }

function submissionCard(s) {
  const judgeCount = s.judge_count || 0;
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <img class="painting-img" src="${paintingUrl(s.image_path)}" alt="${escapeHtml(s.title || 'Painting')}" />
      ${s.mark ? `<span class="tag mark-${s.mark}">${s.mark} (aggregate)</span>` : `<span class="tag closed">unmarked</span>`}
      <h3 style="margin-top:10px;">${escapeHtml(s.title || "Untitled")}</h3>
      <p class="hint">by ${escapeHtml(s.student_name)} — ${escapeHtml(s.competition_title)}</p>
      ${s.description ? `<p>${escapeHtml(s.description)}</p>` : ""}
      ${s.quote ? `<p style="font-style:italic;">“${escapeHtml(s.quote)}”</p>` : ""}
      <div class="label"><span>Submitted ${fmtDate(s.submitted_at)}</span><span>${judgeCount} judge${judgeCount === 1 ? "" : "s"} scored</span></div>
      <button class="btn gold small" style="margin-top:10px;" onclick="openScores(${s.id})">View Scores / Add Yours</button>
    </div>
  `;
}

function currentFilters() {
  return {
    competition_id: document.getElementById("filter-competition")?.value || "",
    mark: document.getElementById("filter-mark")?.value || "",
  };
}

async function fetchAndRender(page = 1) {
  currentPage = page;
  const { competition_id, mark } = currentFilters();
  const params = new URLSearchParams({ page, pageSize: PAGE_SIZE });
  if (competition_id) params.set("competition_id", competition_id);
  if (mark === "__unmarked") params.set("unmarked", "true");
  else if (mark === "__unscored_by_me") params.set("unscored_by_me", "true");
  else if (mark) params.set("mark", mark);

  try {
    const result = await api.get(`/submissions?${params.toString()}`);
    lastKnownSubmissions = result.data;
    document.getElementById("sub-grid").innerHTML = result.data.length
      ? result.data.map(submissionCard).join("")
      : `<div class="empty-state">No submissions match this filter.</div>`;
    renderPager("sub-pager", result, fetchAndRender);
  } catch (err) {
    toast(err.message, true);
  }
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    competitions = await api.get("/competitions");

    main.innerHTML = `
      <p class="hint">Each staff member scores independently — the tag on a card shows the <strong>aggregate</strong> of every judge so far (average mark, or "Disqualified" if any judge flags it). Filtering and pagination both happen on the server, so this stays fast no matter how many submissions pile up over the years.</p>
      <div class="toolbar">
        <div class="field-row" style="gap:12px; display:flex;">
          <select id="filter-competition" style="min-width:220px; margin:0;">
            <option value="">All competitions</option>
            ${competitions.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}
          </select>
          <select id="filter-mark" style="min-width:170px; margin:0;">
            <option value="">All marks</option>
            <option value="__unmarked">Unmarked only</option>
            <option value="__unscored_by_me">Not yet scored by me</option>
            ${MARKS.map((m) => `<option value="${m}">${m}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="grid" id="sub-grid"></div>
      <div id="sub-pager"></div>
    `;

    document.getElementById("filter-competition").addEventListener("change", () => fetchAndRender(1));
    document.getElementById("filter-mark").addEventListener("change", () => fetchAndRender(1));

    await fetchAndRender(1);
  } catch (err) {
    toast(err.message, true);
  }
}

async function openScores(id) {
  const s = lastKnownSubmissions.find((x) => x.id === id);
  if (!s) return;

  modalShell(`<h2>Judging: ${escapeHtml(s.title || "Untitled")}</h2><p class="hint">Loading scores…</p>`);

  try {
    const data = await api.get(`/submissions/${id}/scores`);
    const myScore = data.scores.find((sc) => sc.judge_id === currentUser.id);

    document.querySelector(".modal").innerHTML = `
      <button class="close-x" onclick="closeModal()">&times;</button>
      <h2>Judging: ${escapeHtml(s.title || "Untitled")}</h2>
      <p class="hint">${escapeHtml(s.student_name)} — ${escapeHtml(s.competition_title)}</p>
      <img class="painting-img" src="${paintingUrl(s.image_path)}" style="margin-bottom:16px; border-radius:2px;" />

      ${data.aggregate_mark ? `<p><span class="tag mark-${data.aggregate_mark}">${data.aggregate_mark} — aggregate of ${data.judge_count} judge${data.judge_count === 1 ? "" : "s"}</span></p>` : `<p class="hint">No judge has scored this yet.</p>`}

      ${data.scores.length ? `
        <div class="table-wrap" style="margin:14px 0;">
          <table>
            <thead><tr><th>Judge</th><th>Mark</th><th>Remark</th></tr></thead>
            <tbody>
              ${data.scores.map((sc) => `<tr><td>${escapeHtml(sc.judge_name)}${sc.judge_id === currentUser.id ? " (you)" : ""}</td><td><span class="tag mark-${sc.mark}">${sc.mark}</span></td><td>${escapeHtml(sc.remark || "—")}</td></tr>`).join("")}
            </tbody>
          </table>
        </div>
      ` : ""}

      <h3 style="margin-top:20px;">${myScore ? "Update your score" : "Add your score"}</h3>
      <form id="score-form">
        <label>Mark</label>
        <select name="mark" required>
          <option value="">Select a mark…</option>
          ${MARKS.map((m) => `<option value="${m}" ${myScore?.mark === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <label>Remark (strengths, weaknesses, suggestions)</label>
        <textarea name="remark" placeholder="Write feedback for the student...">${escapeHtml(myScore?.remark || "")}</textarea>
        <button class="btn gold" type="submit" style="width:100%; justify-content:center;">${myScore ? "Update my score" : "Save my score"}</button>
      </form>
    `;

    document.getElementById("score-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api.post(`/submissions/${id}/scores`, payload);
        toast("Your score was saved.");
        closeModal();
        fetchAndRender(currentPage);
      } catch (err) {
        toast(err.message, true);
      }
    });
  } catch (err) {
    closeModal();
    toast(err.message, true);
  }
}

// Live-refresh the current page whenever a new submission comes in while this page is open.
window.onRealtimeNewSubmission = () => fetchAndRender(currentPage);

load();
