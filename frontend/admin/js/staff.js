Auth.guard(["admin"]);
renderHeader();
renderDashShell({ role: "admin", active: "/admin/staff.html", title: "Staff Accounts" });

let allStaff = [];
let currentPage = 1;
let currentSearch = "";
const PAGE_SIZE = 8;

function staffRow(s) {
  return `
    <tr>
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.username)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.subject || "—")}</td>
      <td>${escapeHtml(s.classes || "—")}</td>
      <td>${s.is_active ? '<span class="tag ongoing">active</span>' : '<span class="tag closed">disabled</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="btn secondary small" onclick="openEdit(${s.id})">Edit</button>
        <button class="btn danger small" onclick="removeStaff(${s.id})">Delete</button>
      </td>
    </tr>
  `;
}

function renderShell() {
  const main = document.getElementById("dash-main-content");
  main.innerHTML = `
    <div class="toolbar">
      <input type="search" id="search" placeholder="Search by name, email, username..." value="${escapeHtml(currentSearch)}" />
      <button class="btn gold" onclick="openCreate()">+ Add Staff</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Subject</th><th>Classes</th><th>Status</th><th></th></tr></thead>
        <tbody id="staff-tbody"></tbody>
      </table>
    </div>
    <div id="staff-pager"></div>
  `;

  let debounceTimer;
  document.getElementById("search").addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearch = e.target.value;
      loadStaff(1);
    }, 250);
  });
}

async function loadStaff(page = 1) {
  currentPage = page;
  try {
    const params = new URLSearchParams({ page, pageSize: PAGE_SIZE });
    if (currentSearch) params.set("search", currentSearch);
    const result = await api.get(`/admin/staff?${params.toString()}`);
    allStaff = result.data;

    document.getElementById("staff-tbody").innerHTML = allStaff.length
      ? allStaff.map(staffRow).join("")
      : `<tr><td colspan="7"><div class="empty-state">No staff accounts found.</div></td></tr>`;
    renderPager("staff-pager", result, loadStaff);
  } catch (err) {
    toast(err.message, true);
  }
}

function modalShell(innerHtml) {
  const wrap = document.createElement("div");
  wrap.className = "modal-backdrop";
  wrap.innerHTML = `<div class="modal">
      <button class="close-x" onclick="closeModal()">&times;</button>
      ${innerHtml}
    </div>`;
  wrap.addEventListener("click", (e) => { if (e.target === wrap) closeModal(); });
  document.body.appendChild(wrap);
  return wrap;
}
function closeModal() {
  const el = document.querySelector(".modal-backdrop");
  if (el) el.remove();
}

function openCreate() {
  modalShell(`
    <h2>Add Staff Account</h2>
    <form id="staff-form">
      <div class="field-row">
        <div><label>Full name</label><input name="full_name" required /></div>
        <div><label>Username</label><input name="username" required /></div>
      </div>
      <div class="field-row">
        <div><label>Email</label><input name="email" type="email" required /></div>
        <div><label>Phone</label><input name="phone" /></div>
      </div>
      <div class="field-row">
        <div><label>Subject taught</label><input name="subject" placeholder="e.g. Watercolor Painting" /></div>
        <div><label>Classes</label><input name="classes" placeholder="e.g. Class A, Class B" /></div>
      </div>
      <label>Temporary password</label>
      <input name="password" type="text" required placeholder="Min. 6 characters" />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Create account</button>
    </form>
  `);

  document.getElementById("staff-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api.post("/admin/staff", payload);
      toast("Staff account created.");
      closeModal();
      loadStaff(currentPage);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openEdit(id) {
  const s = allStaff.find((x) => x.id === id);
  if (!s) return;
  modalShell(`
    <h2>Edit Staff Account</h2>
    <form id="staff-edit-form">
      <div class="field-row">
        <div><label>Full name</label><input name="full_name" value="${escapeHtml(s.full_name)}" required /></div>
        <div><label>Email</label><input name="email" type="email" value="${escapeHtml(s.email)}" required /></div>
      </div>
      <div class="field-row">
        <div><label>Phone</label><input name="phone" value="${escapeHtml(s.phone || "")}" /></div>
        <div><label>Status</label>
          <select name="is_active">
            <option value="1" ${s.is_active ? "selected" : ""}>Active</option>
            <option value="0" ${!s.is_active ? "selected" : ""}>Disabled</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div><label>Subject</label><input name="subject" value="${escapeHtml(s.subject || "")}" /></div>
        <div><label>Classes</label><input name="classes" value="${escapeHtml(s.classes || "")}" /></div>
      </div>
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save changes</button>
    </form>
  `);

  document.getElementById("staff-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.is_active = Number(payload.is_active);
    try {
      await api.put(`/admin/staff/${id}`, payload);
      toast("Staff account updated.");
      closeModal();
      loadStaff(currentPage);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function removeStaff(id) {
  if (!confirm("Delete this staff account? This cannot be undone.")) return;
  try {
    await api.del(`/admin/staff/${id}`);
    toast("Staff account deleted.");
    loadStaff(currentPage);
  } catch (err) {
    toast(err.message, true);
  }
}

renderShell();
loadStaff();
