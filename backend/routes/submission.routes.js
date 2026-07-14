const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const { uploadPainting } = require("../middleware/upload.middleware");
const ctrl = require("../controllers/submission.controller");

router.use(requireAuth);

router.get("/", ctrl.listSubmissions);
router.get("/:id", ctrl.getSubmission);

router.post("/", requireRole("student"), uploadPainting.single("painting"), ctrl.createSubmission);
router.put("/:id", requireRole("student"), uploadPainting.single("painting"), ctrl.updateSubmission);
router.delete("/:id", requireRole("student"), ctrl.deleteSubmission);

router.patch("/:id/mark", requireRole("staff"), ctrl.markSubmission);

module.exports = router;
