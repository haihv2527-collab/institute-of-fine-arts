const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const ctrl = require("../controllers/award.controller");

router.get("/recent", ctrl.recentAwards);
router.use(requireAuth);
router.get("/", ctrl.listAwards);
router.post("/", requireRole("staff"), ctrl.createAward);
router.put("/:id", requireRole("staff"), ctrl.updateAward);
router.delete("/:id", requireRole("staff"), ctrl.deleteAward);

module.exports = router;
