const bcrypt = require("bcryptjs");
const db = require("../config/db");
const generateToken = require("../utils/generateToken");

// POST /api/auth/login
function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user || !user.is_active) {
    return res.status(401).json({ message: "Invalid username or password." });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid username or password." });
  }

  const token = generateToken(user);
  delete user.password_hash;

  res.json({ token, user });
}

// GET /api/auth/me
function me(req, res) {
  res.json({ user: req.user });
}

// POST /api/auth/change-password
function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: "Current password is incorrect." });
  }

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
    newHash,
    req.user.id
  );

  res.json({ message: "Password updated successfully." });
}

module.exports = { login, me, changePassword };
