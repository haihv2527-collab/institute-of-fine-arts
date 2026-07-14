const jwt = require("jsonwebtoken");

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, full_name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

module.exports = generateToken;
