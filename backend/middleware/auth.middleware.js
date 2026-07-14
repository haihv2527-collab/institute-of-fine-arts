const jwt = require("jsonwebtoken");
const db = require("../config/db");

/**
 * Verifies the Bearer token sent in the Authorization header and
 * attaches the current user (fresh from the DB) to req.user.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing authentication token." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db
      .prepare("SELECT id, username, role, full_name, email, is_active FROM users WHERE id = ?")
      .get(payload.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ message: "Account not found or disabled." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = requireAuth;
