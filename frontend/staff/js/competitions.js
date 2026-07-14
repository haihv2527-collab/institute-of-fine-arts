Auth.guard(["staff"]);
renderHeader();
renderDashShell({ role: "staff", active: "/staff/competitions.html", title: "Competitions" });

let allCompetitions = [];

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal"><button class="close-x" onclick="closeModal()">&times;</button>${innerHtml}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() {
  const el = document.querySelector(".modal-backdrop");
  if (el) el.remove();
}

function competitionCard(c) {
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <span class="tag ${c.status}">${c.status}</span>
      <h3 style="margin-top:10px;">${escapeHtml(c.title)}</h3>
      <p>${escapeHtml(c.description || "No description.")}</p>
      <p class="hint"><strong>Conditions:</strong> ${escapeHtml(c.conditions || "—")}</p>
      <p class="hint"><strong>Prize:</strong> ${escapeHtml(c.prize || "—")}</p>
      <div class="label"><span>${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}</span></div>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="btn secondary small" onclick="openEdit(${c.id})">Edit</button>
        <button class="btn danger small" onclick="removeCompetition(${c.id})">Delete</button>
      </div>
    </div>
  `;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  try {
    allCompetitions = await api.get("/competitions");
    main.innerHTML = `
      <div class="toolbar">
        <span class="hint">${allCompetitions.length} competition(s) total</span>
        <button class="btn gold" onclick="openCreate()">+ New Competition</button>
      </div>
      <div class="grid" id="comp-grid">
        ${allCompetitions.length ? allCompetitions.map(competitionCard).join("") : `<div class="empty-state">No competitions yet — create the first one.</div>`}
      </div>
    `;
  } catch (err) {
    toast(err.message, true);
  }
}

function openCreate() {
  modalShell(`
    <h2>New Competition</h2>
    <form id="comp-form">
      <label>Title</label><input name="title" required />
      <label>Description</label><textarea name="description"></textarea>
      <label>Conditions</label><textarea name="conditions" placeholder="e.g. One entry per student, watercolor only"></textarea>
      <label>Prize</label><input name="prize" />
      <div class="field-row">
        <div><label>Start date</label><input name="start_date" type="date" required /></div>
        <div><label>End date</label><input name="end_date" type="date" required /></div>
      </div>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Create competition</button>
    </form>
  `);
  document.getElementById("comp-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.post("/competitions", payload);
      toast("Competition created.");
      closeModal();
      load();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openEdit(id) {
  const c = allCompetitions.find((x) => x.id === id);
  if (!c) return;
  modalShell(`
    <h2>Edit Competition</h2>
    <form id="comp-edit-form">
      <label>Title</label><input name="title" value="${escapeHtml(c.title)}" required />
      <label>Description</label><textarea name="description">${escapeHtml(c.description || "")}</textarea>
      <label>Conditions</label><textarea name="conditions">${escapeHtml(c.conditions || "")}</textarea>
      <label>Prize</label><input name="prize" value="${escapeHtml(c.prize || "")}" />
      <div class="field-row">
        <div><label>Start date</label><input name="start_date" type="date" value="${c.start_date}" required /></div>
        <div><label>End date</label><input name="end_date" type="date" value="${c.end_date}" required /></div>
      </div>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save changes</button>
    </form>
  `);
  document.getElementById("comp-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.put(`/competitions/${id}`, payload);
      toast("Competition updated.");
      closeModal();
      load();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function removeCompetition(id) {
  if (!confirm("Delete this competition? All of its submissions will be deleted too.")) return;
  try {
    await api.del(`/competitions/${id}`);
    toast("Competition deleted.");
    load();
  } catch (err) {
    toast(err.message, true);
  }
}

load();
