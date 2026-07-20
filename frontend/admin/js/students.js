Auth.guard(["admin"]);
renderHeader();
renderDashShell({ role: "admin", active: "/admin/students.html", title: "Student Accounts" });

let allStudents = [];
let currentPage = 1;
let currentSearch = "";
const PAGE_SIZE = 8;

function studentRow(s) {
  return `
    <tr>
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.username)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeHtml(s.admission_no || "—")}</td>
      <td>${escapeHtml(s.class_name || "—")}</td>
      <td>${s.is_active ? '<span class="tag ongoing">active</span>' : '<span class="tag closed">disabled</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="btn secondary small" onclick="openEdit(${s.id})">Edit</button>
        <button class="btn secondary small" onclick="openResetPassword(${s.id})">Reset Password</button>
        <button class="btn danger small" onclick="removeStudent(${s.id})">Delete</button>
      </td>
    </tr>
  `;
}

function renderShell() {
  const main = document.getElementById("dash-main-content");
  main.innerHTML = `
    <div class="toolbar">
      <input type="search" id="search" placeholder="Search by name, email, username..." value="${escapeHtml(currentSearch)}" />
      <button class="btn gold" onclick="openCreate()">+ Add Student</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Admission No.</th><th>Class</th><th>Status</th><th></th></tr></thead>
        <tbody id="student-tbody"></tbody>
      </table>
    </div>
    <div id="student-pager"></div>
  `;

  let debounceTimer;
  document.getElementById("search").addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearch = e.target.value;
      loadStudents(1);
    }, 250);
  });
}

async function loadStudents(page = 1) {
  currentPage = page;
  try {
    const params = new URLSearchParams({ page, pageSize: PAGE_SIZE });
    if (currentSearch) params.set("search", currentSearch);
    const result = await api.get(`/admin/students?${params.toString()}`);
    allStudents = result.data;

    document.getElementById("student-tbody").innerHTML = allStudents.length
      ? allStudents.map(studentRow).join("")
      : `<tr><td colspan="7"><div class="empty-state">No student accounts found.</div></td></tr>`;
    renderPager("student-pager", result, loadStudents);
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
    <h2>Add Student Account</h2>
    <form id="student-form">
      <div class="field-row">
        <div><label>Full name</label><input name="full_name" required /></div>
        <div><label>Username</label><input name="username" required /></div>
      </div>
      <div class="field-row">
        <div><label>Email</label><input name="email" type="email" required /></div>
        <div><label>Phone</label><input name="phone" /></div>
      </div>
      <div class="field-row">
        <div><label>Admission No.</label><input name="admission_no" /></div>
        <div><label>Admission date</label><input name="admission_date" type="date" /></div>
      </div>
      <div class="field-row">
        <div><label>Date of birth</label><input name="date_of_birth" type="date" /></div>
        <div><label>Class</label><input name="class_name" /></div>
      </div>
      <div class="field-row">
        <div><label>Guardian name</label><input name="guardian_name" /></div>
        <div><label>Guardian phone</label><input name="guardian_phone" /></div>
      </div>
      <label>Address</label>
      <input name="address" />
      <label>Temporary password</label>
      <input name="password" type="text" required placeholder="Min. 6 characters" />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Create account</button>
    </form>
  `);

  document.getElementById("student-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api.post("/admin/students", payload);
      toast("Student account created.");
      closeModal();
      loadStudents(currentPage);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openEdit(id) {
  const s = allStudents.find((x) => x.id === id);
  if (!s) return;
  modalShell(`
    <h2>Edit Student Account</h2>
    <form id="student-edit-form">
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
        <div><label>Admission No.</label><input name="admission_no" value="${escapeHtml(s.admission_no || "")}" /></div>
        <div><label>Class</label><input name="class_name" value="${escapeHtml(s.class_name || "")}" /></div>
      </div>
      <div class="field-row">
        <div><label>Guardian name</label><input name="guardian_name" value="${escapeHtml(s.guardian_name || "")}" /></div>
        <div><label>Guardian phone</label><input name="guardian_phone" value="${escapeHtml(s.guardian_phone || "")}" /></div>
      </div>
      <label>Address</label>
      <input name="address" value="${escapeHtml(s.address || "")}" />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Save changes</button>
    </form>
  `);

  document.getElementById("student-edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    payload.is_active = Number(payload.is_active);
    try {
      await api.put(`/admin/students/${id}`, payload);
      toast("Student account updated.");
      closeModal();
      loadStudents(currentPage);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openResetPassword(id) {
  const s = allStudents.find((x) => x.id === id);
  if (!s) return;
  modalShell(`
    <h2>Reset Password</h2>
    <p class="hint">Setting a new password for <strong>${escapeHtml(s.full_name)}</strong> (${escapeHtml(s.username)}).
    They will need to use this new password on their next sign-in — there is no way to view their current password.</p>
    <form id="reset-password-form">
      <label>New password</label>
      <input name="password" type="text" required placeholder="Min. 6 characters" />
      <button class="btn gold" type="submit" style="width:100%; justify-content:center;">Set new password</button>
    </form>
  `);

  document.getElementById("reset-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      await api.patch(`/admin/students/${id}/password`, payload);
      toast("Password reset successfully.");
      closeModal();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function removeStudent(id) {
  if (!confirm("Delete this student account? This cannot be undone.")) return;
  try {
    await api.del(`/admin/students/${id}`);
    toast("Student account deleted.");
    loadStudents(currentPage);
  } catch (err) {
    toast(err.message, true);
  }
}

renderShell();
loadStudents();
