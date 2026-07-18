Auth.guard(["manager", "admin"]);
renderHeader();
renderDashShell({ role: "manager", active: "/manager/reports.html", title: "Reports" });

let competitions = [];
let sales = [];

function bestRow(s) {
  return `
    <tr>
      <td>${escapeHtml(s.student_name)}</td>
      <td>${escapeHtml(s.competition_title)}</td>
      <td>${escapeHtml(s.title || "Untitled")}</td>
      <td>${fmtDate(s.submitted_at)}</td>
    </tr>`;
}
function remarkRow(r) {
  return `
    <tr>
      <td>${escapeHtml(r.student_name)}</td>
      <td>${escapeHtml(r.competition_title)}</td>
      <td><span class="tag mark-${r.mark}">${r.mark}</span></td>
      <td>${escapeHtml(r.remark)}</td>
      <td>${escapeHtml(r.marked_by_name || "—")}</td>
    </tr>`;
}
function saleRow(s) {
  return `
    <tr>
      <td>${escapeHtml(s.painting_title || "Untitled")}</td>
      <td>${escapeHtml(s.student_name)}</td>
      <td>${escapeHtml(s.exhibition_title)}</td>
      <td>${s.sold_price ?? "—"}</td>
      <td>${escapeHtml(s.customer_name || "—")}</td>
      <td>${s.paid_to_student ? `Yes — ${fmtDate(s.paid_at)}` : `<span style="color:var(--danger);">Not yet</span>`}</td>
    </tr>`;
}

async function loadBestAndRemarks(competitionId) {
  const query = competitionId ? `?competition_id=${competitionId}` : "";
  const [best, remarks] = await Promise.all([
    api.get(`/manager/reports/best-submissions${query}`),
    api.get(`/manager/remarks${query}`),
  ]);

  document.getElementById("best-count").textContent = `(${best.length})`;
  document.getElementById("best-tbody").innerHTML = best.length
    ? best.map(bestRow).join("")
    : `<tr><td colspan="4"><div class="empty-state">No "Best" marks yet.</div></td></tr>`;

  document.getElementById("remarks-count").textContent = `(${remarks.length})`;
  document.getElementById("remarks-tbody").innerHTML = remarks.length
    ? remarks.map(remarkRow).join("")
    : `<tr><td colspan="5"><div class="empty-state">No remarks recorded yet.</div></td></tr>`;
}

function applySalesFilter() {
  const unpaidOnly = document.getElementById("unpaid-only").checked;
  const filtered = unpaidOnly ? sales.filter((s) => !s.paid_to_student) : sales;
  document.getElementById("sales-tbody").innerHTML = filtered.length
    ? filtered.map(saleRow).join("")
    : `<tr><td colspan="6"><div class="empty-state">No sales match this filter.</div></td></tr>`;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  main.innerHTML = `<p class="hint">Loading reports…</p>`;
  try {
    [competitions, sales] = await Promise.all([
      api.get("/competitions"),
      api.get("/manager/reports/exhibition-sales"),
    ]);
    const unpaidCount = sales.filter((s) => !s.paid_to_student).length;

    main.innerHTML = `
      <h2>Best-marked submissions <span class="count" id="best-count"></span></h2>
      <div class="toolbar">
        <select id="competition-filter" style="min-width:240px; margin:0;">
          <option value="">All competitions</option>
          ${competitions.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join("")}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Competition</th><th>Title</th><th>Submitted</th></tr></thead>
          <tbody id="best-tbody"></tbody>
        </table>
      </div>

      <h2 style="margin-top:40px;">Staff remarks <span class="count" id="remarks-count"></span></h2>
      <p class="hint">Filtered by the same competition selector above.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Competition</th><th>Mark</th><th>Remark</th><th>By</th></tr></thead>
          <tbody id="remarks-tbody"></tbody>
        </table>
      </div>

      <h2 style="margin-top:40px;">Exhibition sales <span class="count">(${sales.length})</span></h2>
      ${unpaidCount ? `<p class="hint" style="color:var(--danger);">⚠ ${unpaidCount} sale${unpaidCount === 1 ? "" : "s"} awaiting payment to the student.</p>` : ""}
      <div class="toolbar">
        <label style="display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--ink-soft);">
          <input type="checkbox" id="unpaid-only" style="width:auto; margin:0;" /> Show unpaid only
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Painting</th><th>Student</th><th>Exhibition</th><th>Sold price</th><th>Buyer</th><th>Paid to student</th></tr></thead>
          <tbody id="sales-tbody">${sales.length ? sales.map(saleRow).join("") : `<tr><td colspan="6"><div class="empty-state">No sales recorded yet.</div></td></tr>`}</tbody>
        </table>
      </div>
    `;

    document.getElementById("competition-filter").addEventListener("change", (e) => loadBestAndRemarks(e.target.value));
    document.getElementById("unpaid-only").addEventListener("change", applySalesFilter);

    await loadBestAndRemarks("");
  } catch (err) {
    toast(err.message, true);
  }
}
load();
