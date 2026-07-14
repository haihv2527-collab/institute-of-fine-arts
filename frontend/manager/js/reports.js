Auth.guard(["manager", "admin"]);
renderHeader();
renderDashShell({ role: "manager", active: "/manager/reports.html", title: "Reports" });

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
      <td>${s.paid_to_student ? "Yes" : "No"}</td>
    </tr>`;
}

async function load() {
  const main = document.getElementById("dash-main-content");
  main.innerHTML = `<p class="hint">Loading reports…</p>`;
  try {
    const [best, remarks, sales] = await Promise.all([
      api.get("/manager/reports/best-submissions"),
      api.get("/manager/remarks"),
      api.get("/manager/reports/exhibition-sales"),
    ]);

    main.innerHTML = `
      <h2>Best-marked submissions <span class="count">(${best.length})</span></h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Competition</th><th>Title</th><th>Submitted</th></tr></thead>
          <tbody>${best.length ? best.map(bestRow).join("") : `<tr><td colspan="4"><div class="empty-state">No "Best" marks yet.</div></td></tr>`}</tbody>
        </table>
      </div>

      <h2 style="margin-top:40px;">Staff remarks <span class="count">(${remarks.length})</span></h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student</th><th>Competition</th><th>Mark</th><th>Remark</th><th>By</th></tr></thead>
          <tbody>${remarks.length ? remarks.map(remarkRow).join("") : `<tr><td colspan="5"><div class="empty-state">No remarks recorded yet.</div></td></tr>`}</tbody>
        </table>
      </div>

      <h2 style="margin-top:40px;">Exhibition sales <span class="count">(${sales.length})</span></h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Painting</th><th>Student</th><th>Exhibition</th><th>Sold price</th><th>Buyer</th><th>Paid to student</th></tr></thead>
          <tbody>${sales.length ? sales.map(saleRow).join("") : `<tr><td colspan="6"><div class="empty-state">No sales recorded yet.</div></td></tr>`}</tbody>
        </table>
      </div>
    `;
  } catch (err) {
    toast(err.message, true);
  }
}
load();
