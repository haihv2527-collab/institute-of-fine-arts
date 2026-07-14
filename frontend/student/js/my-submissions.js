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
      ${s.remark ? `<p class="hint"><strong>Teacher's remark:</strong> ${escapeHtml(s.remark)}</p>` : ""}
      <div class="label"><span>Submitted ${fmtDate(s.submitted_at)}</span></div>
      ${editable ? `
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn secondary small" onclick="openEdit(${s.id})">Edit</button>
          <button class="btn danger small" onclick="removeSubmission(${s.id})">Delete</button>
        </div>
      ` : `<p class="hint" style="margin-top:12px;">Deadline passed — no longer editable.</p>`}
    </div>
  `;
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

async function removeSubmission(id) {
  if (!confirm("Delete this submission?")) return;
  try {
    await api.del(`/submissions/${id}`);
    toast("Submission deleted.");
    load();
  } catch (err) {
    toast(err.message, true);
  }
}

load();
