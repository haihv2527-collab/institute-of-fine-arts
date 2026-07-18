Auth.guard(["staff"]);
renderHeader();
renderDashShell({ role: "staff", active: "/staff/exhibitions.html", title: "Exhibitions" });

const params = new URLSearchParams(window.location.search);
const viewingId = params.get("id");

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal"><button class="close-x" onclick="closeModal()">&times;</button>${innerHtml}</div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
}
function closeModal() { const el = document.querySelector(".modal-backdrop"); if (el) el.remove(); }

if (viewingId) {
  loadDetail(viewingId);
} else {
  loadList();
}

// ------------------------- LIST VIEW -------------------------

let exhibitions = [];

function exhibitionCard(e) {
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <span class="tag ${e.status}">${e.status}</span>
      <h3 style="margin-top:10px;">${escapeHtml(e.title)}</h3>
      <p>${escapeHtml(e.description || "No description.")}</p>
      <p class="hint"><strong>Location:</strong> ${escapeHtml(e.location || "—")}</p>
      <div class="label"><span>${fmtDate(e.start_date)} → ${fmtDate(e.end_date)}</span></div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <a class="btn gold small" href="/staff/exhibitions.html?id=${e.id}">Manage Paintings</a>
        <button class="btn secondary small" onclick="openEdit(${e.id})">Edit</button>
        <button class="btn danger small" onclick="removeExhibition(${e.id})">Delete</button>
      </div>
    </div>
  `;
}

async function loadList() {
  const main = document.getElementById("dash-main-content");
  try {
    exhibitions = await api.get("/exhibitions");
    main.innerHTML = `
      <div class="toolbar">
        <span class="hint">${exhibitions.length} exhibition(s)</span>
        <button class="btn gold" onclick="openCreate()">+ New Exhibition</button>
      </div>
      <div class="grid">
        ${exhibitions.length ? exhibitions.map(exhibitionCard).join("") : `<div class="empty-state">No exhibitions yet — create the first one.</div>`}
      </div>
    `;
  } catch (err) {
    toast(err.message, true);
  }
}

function openCreate() {
  modalShell(`
    <h2>New Exhibition</h2>
    <form id="ex-form">
      <label>Title</label><input name="title" required />
      <label>Description</label><textarea name="description"></textarea>
      <label>Location</label><input name="location" />
      <div class="field-row">
        <div><label>Start date</label><input name="start_date" type="date" required /></div>
        <div><label>End date</label><input name="end_date" type="date" required /></div>
      </div>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Create exhibition</button>
    </form>
  `);
  document.getElementById("ex-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.post("/exhibitions", payload);
      toast("Exhibition created.");
      closeModal();
      loadList();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openEdit(id) {
  const ex = exhibitions.find((x) => x.id === id);
  if (!ex) return;
  modalShell(`
    <h2>Edit Exhibition</h2>
    <form id="ex-edit-form">
      <label>Title</label><input name="title" value="${escapeHtml(ex.title)}" required />
      <label>Description</label><textarea name="description">${escapeHtml(ex.description || "")}</textarea>
      <label>Location</label><input name="location" value="${escapeHtml(ex.location || "")}" />
      <div class="field-row">
        <div><label>Start date</label><input name="start_date" type="date" value="${ex.start_date}" required /></div>
        <div><label>End date</label><input name="end_date" type="date" value="${ex.end_date}" required /></div>
      </div>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save changes</button>
    </form>
  `);
  document.getElementById("ex-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.put(`/exhibitions/${id}`, payload);
      toast("Exhibition updated.");
      closeModal();
      loadList();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function removeExhibition(id) {
  if (!confirm("Delete this exhibition and all of its painting listings?")) return;
  try {
    await api.del(`/exhibitions/${id}`);
    toast("Exhibition deleted.");
    loadList();
  } catch (err) {
    toast(err.message, true);
  }
}

// ------------------------- DETAIL VIEW (paintings) -------------------------

let currentExhibition = null;
let exhibitionPaintings = [];
let allSubmissions = [];

function paintingCard(p) {
  const unpaid = p.status === "sold" && !p.paid_to_student;
  return `
    <div class="frame">
      <span class="corner tl"></span><span class="corner tr"></span>
      <span class="corner bl"></span><span class="corner br"></span>
      <img class="painting-img" src="${paintingUrl(p.image_path)}" alt="${escapeHtml(p.painting_title || 'Painting')}" />
      <span class="tag ${p.status}">${p.status.replace("_", " ")}</span>
      ${unpaid ? `<span class="tag sold" style="margin-left:6px;">payment pending</span>` : ""}
      <h3 style="margin-top:10px;">${escapeHtml(p.painting_title || "Untitled")}</h3>
      <p class="hint">by ${escapeHtml(p.student_name)}</p>
      <p class="hint"><strong>Asking price:</strong> ${p.asking_price ?? "—"}</p>
      ${p.status === "sold" ? `
        <p class="hint"><strong>Sold price:</strong> ${p.sold_price ?? "—"}</p>
        <p class="hint"><strong>Buyer:</strong> ${escapeHtml(p.customer_name || "—")} ${p.customer_contact ? `(${escapeHtml(p.customer_contact)})` : ""}</p>
        <p class="hint"><strong>Paid to student:</strong> ${p.paid_to_student ? `Yes — ${fmtDate(p.paid_at)}` : "Not yet"}</p>
      ` : ""}
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn secondary small" onclick="openManagePainting(${p.id})">Manage Sale</button>
        <button class="btn danger small" onclick="removePainting(${p.id})">Remove</button>
      </div>
    </div>
  `;
}

function applyPaintingFilter() {
  const val = document.getElementById("painting-filter").value;
  let list = exhibitionPaintings;
  if (val === "unpaid") list = list.filter((p) => p.status === "sold" && !p.paid_to_student);
  else if (val) list = list.filter((p) => p.status === val);

  document.getElementById("paintings-grid").innerHTML = list.length
    ? list.map(paintingCard).join("")
    : `<div class="empty-state">No paintings match this filter.</div>`;
}

async function loadDetail(exhibitionId) {
  const main = document.getElementById("dash-main-content");
  try {
    [currentExhibition, exhibitionPaintings, allSubmissions] = await Promise.all([
      api.get(`/exhibitions/${exhibitionId}`),
      api.get(`/exhibitions/${exhibitionId}/paintings`),
      api.get(`/submissions`),
    ]);

    const unpaidCount = exhibitionPaintings.filter((p) => p.status === "sold" && !p.paid_to_student).length;

    main.innerHTML = `
      <p><a href="/staff/exhibitions.html">&larr; Back to all exhibitions</a></p>
      <h2 style="margin-top:6px;">${escapeHtml(currentExhibition.title)} <span class="tag ${currentExhibition.status}">${currentExhibition.status}</span></h2>
      <p class="hint">${fmtDate(currentExhibition.start_date)} → ${fmtDate(currentExhibition.end_date)} · ${escapeHtml(currentExhibition.location || "No location set")}</p>
      ${unpaidCount ? `<p class="hint" style="color:var(--danger);">⚠ ${unpaidCount} painting${unpaidCount === 1 ? "" : "s"} sold but not yet paid to the student.</p>` : ""}
      <div class="toolbar" style="margin-top:20px;">
        <div style="display:flex; gap:12px; align-items:center;">
          <span class="hint">${exhibitionPaintings.length} painting(s) in this exhibition</span>
          <select id="painting-filter" style="min-width:190px; margin:0;">
            <option value="">All paintings</option>
            <option value="on_display">On display</option>
            <option value="sold">Sold</option>
            <option value="unpaid">Sold — payment pending</option>
            <option value="returned">Returned</option>
          </select>
        </div>
        <button class="btn gold" onclick="openAddPainting()">+ Add Painting</button>
      </div>
      <div class="grid" id="paintings-grid">
        ${exhibitionPaintings.length ? exhibitionPaintings.map(paintingCard).join("") : `<div class="empty-state">No paintings added yet. Select strong submissions to feature here.</div>`}
      </div>
    `;

    document.getElementById("painting-filter").addEventListener("change", applyPaintingFilter);
  } catch (err) {
    toast(err.message, true);
  }
}

function openAddPainting() {
  const alreadyAdded = new Set(exhibitionPaintings.map((p) => p.submission_id));
  const eligible = allSubmissions.filter((s) => s.mark && s.mark !== "Disqualified" && !alreadyAdded.has(s.id));

  modalShell(`
    <h2>Add Painting to Exhibition</h2>
    <p class="hint">Filter submissions by mark to pick the strongest work for the show.</p>
    <form id="add-painting-form">
      <label>Filter by mark</label>
      <select id="mark-filter">
        <option value="">All marked (excl. Disqualified)</option>
        <option value="Best">Best only</option>
        <option value="Better">Better only</option>
        <option value="Good">Good only</option>
      </select>
      <label>Submission</label>
      <select name="submission_id" id="submission-select" required></select>
      <label>Asking price</label>
      <input name="asking_price" type="number" step="0.01" min="0" placeholder="e.g. 150.00" />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Add to exhibition</button>
    </form>
  `);

  function renderOptions(list) {
    document.getElementById("submission-select").innerHTML = list.length
      ? list.map((s) => `<option value="${s.id}">${escapeHtml(s.student_name)} — ${escapeHtml(s.title || "Untitled")} (${s.mark})</option>`).join("")
      : `<option value="">No eligible submissions</option>`;
  }
  renderOptions(eligible);

  document.getElementById("mark-filter").addEventListener("change", (e) => {
    const val = e.target.value;
    renderOptions(val ? eligible.filter((s) => s.mark === val) : eligible);
  });

  document.getElementById("add-painting-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    if (!payload.submission_id) return toast("No submission selected.", true);
    try {
      await api.post(`/exhibitions/${currentExhibition.id}/paintings`, payload);
      toast("Painting added.");
      closeModal();
      loadDetail(currentExhibition.id);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openManagePainting(paintingId) {
  const p = exhibitionPaintings.find((x) => x.id === paintingId);
  if (!p) return;
  modalShell(`
    <h2>Manage Sale</h2>
    <p class="hint">${escapeHtml(p.painting_title || "Untitled")} — ${escapeHtml(p.student_name)}</p>
    <form id="manage-form">
      <label>Asking price</label>
      <input name="asking_price" type="number" step="0.01" value="${p.asking_price ?? ""}" />
      <label>Status</label>
      <select name="status">
        <option value="on_display" ${p.status === "on_display" ? "selected" : ""}>On display</option>
        <option value="sold" ${p.status === "sold" ? "selected" : ""}>Sold</option>
        <option value="returned" ${p.status === "returned" ? "selected" : ""}>Returned to student</option>
      </select>
      <label>Sold price</label>
      <input name="sold_price" type="number" step="0.01" value="${p.sold_price ?? ""}" />
      <label>Customer name</label>
      <input name="customer_name" value="${escapeHtml(p.customer_name || "")}" />
      <label>Customer contact</label>
      <input name="customer_contact" value="${escapeHtml(p.customer_contact || "")}" />
      <label>Paid to student?</label>
      <select name="paid_to_student">
        <option value="0" ${!p.paid_to_student ? "selected" : ""}>Not yet paid</option>
        <option value="1" ${p.paid_to_student ? "selected" : ""}>Paid</option>
      </select>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save</button>
    </form>
  `);

  document.getElementById("manage-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.paid_to_student = Number(payload.paid_to_student);
    try {
      await api.patch(`/exhibitions/paintings/${paintingId}`, payload);
      toast("Painting updated.");
      closeModal();
      loadDetail(currentExhibition.id);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function removePainting(paintingId) {
  if (!confirm("Remove this painting from the exhibition?")) return;
  try {
    await api.del(`/exhibitions/paintings/${paintingId}`);
    toast("Painting removed.");
    loadDetail(currentExhibition.id);
  } catch (err) {
    toast(err.message, true);
  }
}
