Auth.guard(["staff"]);
renderHeader();
renderDashShell({ role: "staff", active: "/staff/submissions.html", title: "Judge Submissions" });

const MARKS = ["Best", "Better", "Good", "Moderate", "Normal", "Disqualified"];
let competitions = [];
let submissions = [];

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal"><button class="close-x" onclick="closeModal()">&times;</button>${innerHtml}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { const el = document.querySelector(".modal-backdrop"); if (el) el.remove(); }

function submissionCard(s) {
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <img class="painting-img" src="${paintingUrl(s.image_path)}" alt="${escapeHtml(s.title || 'Painting')}" />
      ${s.mark ? `<span class="tag mark-${s.mark}">${s.mark}</span>` : `<span class="tag closed">unmarked</span>`}
      <h3 style="margin-top:10px;">${escapeHtml(s.title || "Untitled")}</h3>
      <p class="hint">by ${escapeHtml(s.student_name)} — ${escapeHtml(s.competition_title)}</p>
      ${s.description ? `<p>${escapeHtml(s.description)}</p>` : ""}
      ${s.quote ? `<p style="font-style:italic;">“${escapeHtml(s.quote)}”</p>` : ""}
      ${s.remark ? `<p class="hint"><strong>Remark:</strong> ${escapeHtml(s.remark)}</p>` : ""}
      <div class="label"><span>Submitted ${fmtDate(s.submitted_at)}</span></div>
      <button class="btn gold small" style="margin-top:10px;" onclick="openMark(${s.id})">Mark / Remark</button>
    </div>
  `;
}

function renderGrid(list) {
  document.getElementById("sub-grid").innerHTML = list.length
    ? list.map(submissionCard).join("")
    : `<div class="empty-state">No submissions match this filter.</div>`;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    [competitions, submissions] = await Promise.all([
      api.get("/competitions"),
      api.get("/submissions"),
    ]);

    main.innerHTML = `
      <div class="toolbar">
        <div class="field-row" style="gap:12px; display:flex;">
          <select id="filter-competition" style="min-width:220px; margin:0;">
            <option value="">All competitions</option>
            ${competitions.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}
          </select>
          <select id="filter-mark" style="min-width:170px; margin:0;">
            <option value="">All marks</option>
            <option value="__unmarked">Unmarked only</option>
            ${MARKS.map((m) => `<option value="${m}">${m}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="grid" id="sub-grid"></div>
    `;
    renderGrid(submissions);

    document.getElementById("filter-competition").addEventListener("change", applyFilters);
    document.getElementById("filter-mark").addEventListener("change", applyFilters);
  } catch (err) {
    toast(err.message, true);
  }
}

function applyFilters() {
  const compId = document.getElementById("filter-competition").value;
  const mark = document.getElementById("filter-mark").value;
  let list = submissions;
  if (compId) list = list.filter((s) => String(s.competition_id) === compId);
  if (mark === "__unmarked") list = list.filter((s) => !s.mark);
  else if (mark) list = list.filter((s) => s.mark === mark);
  renderGrid(list);
}

function openMark(id) {
  const s = submissions.find((x) => x.id === id);
  if (!s) return;
  modalShell(`
    <h2>Mark Submission</h2>
    <p class="hint">${escapeHtml(s.student_name)} — ${escapeHtml(s.competition_title)}</p>
    <img class="painting-img" src="${paintingUrl(s.image_path)}" style="margin-bottom:16px; border-radius:2px;" />
    <form id="mark-form">
      <label>Mark</label>
      <select name="mark" required>
        <option value="">Select a mark…</option>
        ${MARKS.map((m) => `<option value="${m}" ${s.mark === m ? "selected" : ""}>${m}</option>`).join("")}
      </select>
      <label>Remark (strengths, weaknesses, suggestions)</label>
      <textarea name="remark" placeholder="Write feedback for the student...">${escapeHtml(s.remark || "")}</textarea>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save mark</button>
    </form>
  `);

  document.getElementById("mark-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.patch(`/submissions/${id}/mark`, payload);
      toast("Submission marked.");
      closeModal();
      load();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

load();
