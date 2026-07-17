Auth.guard(["student"]);
renderHeader();
renderDashShell({ role: "student", active: "/student/my-submissions.html", title: "My Submissions" });

let submissions = [];

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal"><button class="close-x" onclick="closeModal()">&times;</button>${innerHtml}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { const el = document.querySelector(".modal-backdrop"); if (el) el.remove(); }

function isEditable(s) {
  const today = new Date().toISOString().slice(0, 10);
  return today <= s.end_date;
}

function submissionCard(s) {
  const editable = isEditable(s);
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <img class="painting-img" src="${paintingUrl(s.image_path)}" alt="${escapeHtml(s.title || 'Painting')}" />
      ${s.mark ? `<span class="tag mark-${s.mark}">${s.mark}</span>` : `<span class="tag closed">awaiting mark</span>`}
      <h3 style="margin-top:10px;">${escapeHtml(s.title || "Untitled")}</h3>
      <p class="hint">${escapeHtml(s.competition_title)}</p>
      ${s.description ? `<p>${escapeHtml(s.description)}</p>` : ""}
      <div class="label"><span>Submitted ${fmtDate(s.submitted_at)}</span></div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn secondary small" onclick="openFeedback(${s.id})">View Judges' Feedback</button>
        ${editable ? `
          <button class="btn secondary small" onclick="openEdit(${s.id})">Edit</button>
          <button class="btn danger small" onclick="removeSubmission(${s.id})">Delete</button>
        ` : ""}
      </div>
      ${!editable ? `<p class="hint" style="margin-top:8px;">Deadline passed — no longer editable.</p>` : ""}
    </div>
  `;
}

async function openFeedback(id) {
  const s = submissions.find((x) => x.id === id);
  if (!s) return;

  modalShell(`<h2>Judges' Feedback</h2><p class="hint">Loading…</p>`);

  try {
    const data = await api.get(`/submissions/${id}/scores`);
    document.querySelector(".modal").innerHTML = `
      <button class="close-x" onclick="closeModal()">&times;</button>
      <h2>Judges' Feedback</h2>
      <p class="hint">${escapeHtml(s.title || "Untitled")} — ${escapeHtml(s.competition_title)}</p>
      ${data.aggregate_mark
        ? `<p><span class="tag mark-${data.aggregate_mark}">${data.aggregate_mark} — aggregate of ${data.judge_count} judge${data.judge_count === 1 ? "" : "s"}</span></p>`
        : `<p class="hint">No judge has scored your painting yet — check back soon.</p>`}
      ${data.scores.length ? data.scores.map((sc) => `
        <div class="frame" style="margin-top:12px; padding:14px;">
          <span class="tag mark-${sc.mark}">${sc.mark}</span>
          <p style="margin-top:8px; font-weight:600;">${escapeHtml(sc.judge_name)}</p>
          <p class="hint">${escapeHtml(sc.remark || "No written remark.")}</p>
        </div>
      `).join("") : ""}
    `;
  } catch (err) {
    closeModal();
    toast(err.message, true);
  }
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    submissions = await api.get("/submissions");
    main.innerHTML = `
      <div class="grid">
        ${submissions.length ? submissions.map(submissionCard).join("") : `<div class="empty-state">You haven't submitted any paintings yet. Visit <a href="/student/competitions.html">Competitions</a> to enter one.</div>`}
      </div>
    `;
  } catch (err) {
    toast(err.message, true);
  }
}

function openEdit(id) {
  const s = submissions.find((x) => x.id === id);
  if (!s) return;
  modalShell(`
    <h2>Edit Submission</h2>
    <form id="edit-form">
      <label>Painting title</label>
      <input name="title" value="${escapeHtml(s.title || "")}" />
      <label>Description</label>
      <textarea name="description">${escapeHtml(s.description || "")}</textarea>
      <label>Poem / quote</label>
      <textarea name="quote">${escapeHtml(s.quote || "")}</textarea>
      <label>Replace image (optional — leave blank to keep current JPEG)</label>
      <input name="painting" type="file" accept="image/jpeg" />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save changes</button>
    </form>
  `);

  document.getElementById("edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.put(`/submissions/${id}`, fd, true);
      toast("Submission updated.");
      closeModal();
      load();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

window.onRealtimeSubmissionScored = () => load();

load();
