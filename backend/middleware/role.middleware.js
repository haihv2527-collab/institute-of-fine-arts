/**
 * Restricts a route to one or more roles.
 * Usage: router.get("/", requireAuth, requireRole("admin", "manager"), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. This action requires role: ${allowedRoles.join(" or ")}.`,
      });
    }
    next();
  };
}

module.exports = requireRole;
