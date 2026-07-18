Auth.guard(["staff"]);
renderHeader();
renderDashShell({ role: "staff", active: "/staff/awards.html", title: "Awards" });

let awards = [];
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

function awardRow(a) {
  return `
    <tr>
      <td>${escapeHtml(a.award_name)}</td>
      <td>${escapeHtml(a.student_name)}</td>
      <td>${escapeHtml(a.competition_title)}</td>
      <td>${escapeHtml(a.description || "—")}</td>
      <td>${fmtDate(a.created_at)}</td>
      <td style="white-space:nowrap;">
        <button class="btn danger small" onclick="removeAward(${a.id})">Delete</button>
      </td>
    </tr>`;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    [awards, competitions, submissions] = await Promise.all([
      api.get("/awards"),
      api.get("/competitions"),
      api.get("/submissions", ),
    ]);

    main.innerHTML = `
      <div class="toolbar">
        <div style="display:flex; gap:12px; align-items:center;">
          <span class="hint">${awards.length} award(s) given</span>
          <select id="award-filter" style="min-width:220px; margin:0;">
            <option value="">All competitions</option>
            ${competitions.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}
          </select>
        </div>
        <button class="btn gold" onclick="openCreate()">+ Give Award</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Award</th><th>Student</th><th>Competition</th><th>Notes</th><th>Date</th><th></th></tr></thead>
          <tbody id="awards-tbody">${awards.length ? awards.map(awardRow).join("") : `<tr><td colspan="6"><div class="empty-state">No awards yet.</div></td></tr>`}</tbody>
        </table>
      </div>
    `;

    document.getElementById("award-filter").addEventListener("change", (e) => {
      const compId = e.target.value;
      const filtered = compId ? awards.filter((a) => String(a.competition_id) === compId) : awards;
      document.getElementById("awards-tbody").innerHTML = filtered.length
        ? filtered.map(awardRow).join("")
        : `<tr><td colspan="6"><div class="empty-state">No awards for this competition.</div></td></tr>`;
    });
  } catch (err) {
    toast(err.message, true);
  }
}

function openCreate() {
  modalShell(`
    <h2>Give an Award</h2>
    <form id="award-form">
      <label>Competition</label>
      <select name="competition_id" id="award-comp" required>
        <option value="">Select competition…</option>
        ${competitions.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}
      </select>
      <label>Submission (optional — links the award to a specific painting)</label>
      <select name="submission_id" id="award-submission">
        <option value="">No specific submission</option>
      </select>
      <label>Student</label>
      <select name="student_id" id="award-student" required>
        <option value="">Select a submission above to auto-fill, or pick a competition first</option>
      </select>
      <label>Award name</label>
      <input name="award_name" placeholder="e.g. Best in Show, 1st Prize" required />
      <label>Description / notes</label>
      <textarea name="description"></textarea>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Give award</button>
    </form>
  `);

  const compSelect = document.getElementById("award-comp");
  const subSelect = document.getElementById("award-submission");
  const studentSelect = document.getElementById("award-student");

  compSelect.addEventListener("change", () => {
    const compSubs = submissions.filter((s) => String(s.competition_id) === compSelect.value);
    subSelect.innerHTML = `<option value="">No specific submission</option>` +
      compSubs.map((s) => `<option value="${s.id}" data-student="${s.student_id}">${escapeHtml(s.student_name)} — ${escapeHtml(s.title || "Untitled")}</option>`).join("");

    const uniqueStudents = [...new Map(compSubs.map((s) => [s.student_id, s.student_name])).entries()];
    studentSelect.innerHTML = `<option value="">Select student…</option>` +
      uniqueStudents.map(([id, name]) => `<option value="${id}">${escapeHtml(name)}</option>`).join("");
  });

  subSelect.addEventListener("change", () => {
    const opt = subSelect.selectedOptions[0];
    if (opt && opt.dataset.student) studentSelect.value = opt.dataset.student;
  });

  document.getElementById("award-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    if (!payload.submission_id) delete payload.submission_id;
    try {
      await api.post("/awards", payload);
      toast("Award given.");
      closeModal();
      load();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function removeAward(id) {
  if (!confirm("Delete this award?")) return;
  try {
    await api.del(`/awards/${id}`);
    toast("Award deleted.");
    load();
  } catch (err) {
    toast(err.message, true);
  }
}

load();
