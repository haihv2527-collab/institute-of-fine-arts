const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const ctrl = require("../controllers/competition.controller");

router.get("/", requireAuth, ctrl.listCompetitions);
router.get("/:id", requireAuth, ctrl.getCompetition);

router.post("/", requireAuth, requireRole("staff"), ctrl.createCompetition);
router.put("/:id", requireAuth, requireRole("staff"), ctrl.updateCompetition);
router.delete("/:id", requireAuth, requireRole("staff"), ctrl.deleteCompetition);

module.exports = router;
