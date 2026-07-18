/* ============================================================
   pagination.js — renders a small Prev / Page X of Y / Next control
   and wires it to a callback. Shared by every page that lists data
   from a server-side-paginated endpoint (submissions, staff, students).
   ============================================================ */

/**
 * Renders pager controls into the element with id `containerId`.
 * @param {string} containerId - id of the element to render into
 * @param {{page: number, totalPages: number, total: number}} info - pagination metadata from the API
 * @param {(newPage: number) => void} onChange - called with the new page number when Prev/Next is clicked
 */
function renderPager(containerId, { page, totalPages, total }, onChange) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (totalPages <= 1) {
    el.innerHTML = total ? `<p class="hint">${total} result${total === 1 ? "" : "s"} total.</p>` : "";
    return;
  }

  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; margin-top:20px;">
      <button class="btn secondary small" id="pager-prev" ${page <= 1 ? "disabled" : ""}>&larr; Prev</button>
      <span class="hint">Page ${page} of ${totalPages} — ${total} result${total === 1 ? "" : "s"} total</span>
      <button class="btn secondary small" id="pager-next" ${page >= totalPages ? "disabled" : ""}>Next &rarr;</button>
    </div>
  `;

  const prevBtn = document.getElementById("pager-prev");
  const nextBtn = document.getElementById("pager-next");
  if (prevBtn) prevBtn.addEventListener("click", () => { if (page > 1) onChange(page - 1); });
  if (nextBtn) nextBtn.addEventListener("click", () => { if (page < totalPages) onChange(page + 1); });
}
