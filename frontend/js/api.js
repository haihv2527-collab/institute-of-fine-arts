/* ============================================================
   api.js — thin fetch wrapper shared by every page.
   Talks to the Express backend at the same origin (/api/...).
   ============================================================ */

const API_BASE = "/api";

const Auth = {
  getToken() {
    return localStorage.getItem("ifa_token");
  },
  getUser() {
    const raw = localStorage.getItem("ifa_user");
    return raw ? JSON.parse(raw) : null;
  },
  setSession(token, user) {
    localStorage.setItem("ifa_token", token);
    localStorage.setItem("ifa_user", JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem("ifa_token");
    localStorage.removeItem("ifa_user");
  },
  isLoggedIn() {
    return !!this.getToken();
  },
  logout() {
    this.clearSession();
    window.location.href = "/login.html";
  },
  /**
   * Call at the top of any protected page.
   * Redirects to login if not authenticated, or to the correct
   * dashboard if the role does not match what the page expects.
   */
  guard(allowedRoles) {
    const user = this.getUser();
    if (!this.isLoggedIn() || !user) {
      window.location.href = "/login.html";
      return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      window.location.href = roleHome(user.role);
      return null;
    }
    return user;
  },
};

function roleHome(role) {
  switch (role) {
    case "admin": return "/admin/dashboard.html";
    case "manager": return "/manager/dashboard.html";
    case "staff": return "/staff/dashboard.html";
    case "student": return "/student/dashboard.html";
    default: return "/login.html";
  }
}

/**
 * Core request helper. Automatically attaches the JWT and
 * parses JSON. Pass a FormData body to send a file upload
 * (Content-Type is left for the browser to set in that case).
 */
async function apiFetch(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    if (res.status === 401) {
      Auth.clearSession();
      window.location.href = "/login.html";
    }
    throw new Error(message);
  }

  return data;
}

const api = {
  get: (path) => apiFetch(path),
  post: (path, body, isForm = false) => apiFetch(path, { method: "POST", body, isForm }),
  put: (path, body, isForm = false) => apiFetch(path, { method: "PUT", body, isForm }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body }),
  del: (path) => apiFetch(path, { method: "DELETE" }),
};

function paintingUrl(filename) {
  return `/uploads/submissions/${filename}`;
}

function toast(message, isError = false) {
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function fmtDate(str) {
  if (!str) return "—";
  return str.length > 10 ? str.slice(0, 10) : str;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
