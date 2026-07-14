const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const ctrl = require("../controllers/manager.controller");

router.use(requireAuth, requireRole("manager", "admin"));

router.get("/overview", ctrl.overview);
router.get("/reports/best-submissions", ctrl.bestSubmissionsReport);
router.get("/reports/exhibition-sales", ctrl.exhibitionSalesReport);
router.get("/remarks", ctrl.remarksReport);

module.exports = router;
