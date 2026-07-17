/* ============================================================
   layout.js — renders the shared site header and, on role
   dashboards, the left sidebar. Keeps every page's markup
   consistent without a build step or templating engine.
   ============================================================ */

function renderHeader(mountId = "site-header") {
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const user = Auth.getUser();

  mount.innerHTML = `
    <header class="site-header">
      <div class="wrap">
        <a class="brand" href="/index.html">
          <span class="mark">IFA</span>
          <span class="brand-text">
            <span class="name">Institute of Fine Arts</span>
            <span class="tag">Competitions &amp; Exhibitions</span>
          </span>
        </a>
        <nav class="nav">
          <a href="/index.html">Home</a>
          ${user ? `
            <a href="${roleHome(user.role)}">Dashboard</a>
            <span class="role-chip">${escapeHtml(user.full_name)} · ${user.role}</span>
            <button class="linklike" id="logout-btn">Logout</button>
          ` : `
            <a href="/login.html">Sign in</a>
          `}
        </nav>
      </div>
    </header>
  `;

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => Auth.logout());

  if (typeof connectRealtime === "function") connectRealtime();
}

const SIDE_LINKS = {
  admin: [
    { href: "/admin/dashboard.html", label: "Overview" },
    { href: "/admin/staff.html", label: "Staff Accounts" },
    { href: "/admin/students.html", label: "Student Accounts" },
  ],
  manager: [
    { href: "/manager/dashboard.html", label: "Overview" },
    { href: "/manager/reports.html", label: "Reports" },
  ],
  staff: [
    { href: "/staff/dashboard.html", label: "Overview" },
    { href: "/staff/competitions.html", label: "Competitions" },
    { href: "/staff/submissions.html", label: "Judge Submissions" },
    { href: "/staff/awards.html", label: "Awards" },
    { href: "/staff/exhibitions.html", label: "Exhibitions" },
  ],
  student: [
    { href: "/student/dashboard.html", label: "Overview" },
    { href: "/student/competitions.html", label: "Competitions" },
    { href: "/student/my-submissions.html", label: "My Submissions" },
    { href: "/student/exhibition-status.html", label: "My Exhibited Paintings" },
  ],
};

/**
 * Renders the sidebar for a role dashboard shell.
 * Call renderDashShell({ role, active, mainHtml }) to build the
 * whole two-column layout in one go.
 */
function renderDashShell({ role, active, title, mainId = "dash-main-content" }) {
  const shell = document.getElementById("dash-shell");
  if (!shell) return;

  const links = SIDE_LINKS[role] || [];
  shell.innerHTML = `
    <aside class="dash-side">
      <div class="side-title">${role} panel</div>
      ${links.map((l) => `<a href="${l.href}" class="${l.href === active ? "active" : ""}">${l.label}</a>`).join("")}
    </aside>
    <main class="dash-main">
      <span class="eyebrow">${role} panel</span>
      <h1>${title}</h1>
      <div id="${mainId}"></div>
    </main>
  `;
}
