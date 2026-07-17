const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const { uploadPainting } = require("../middleware/upload.middleware");
const ctrl = require("../controllers/submission.controller");

router.use(requireAuth);

router.get("/", ctrl.listSubmissions);
router.get("/:id", ctrl.getSubmission);

// Student actions
router.post("/", requireRole("student"), uploadPainting.single("painting"), ctrl.createSubmission);
router.put("/:id", requireRole("student"), uploadPainting.single("painting"), ctrl.updateSubmission);
router.delete("/:id", requireRole("student"), ctrl.deleteSubmission);

// Multi-judge scoring — any staff member can score any submission; each
// staff's own score is independent (upsert by submission+judge), and the
// submission's overall mark/remark is a computed aggregate of all judges.
router.get("/:id/scores", ctrl.listJudgeScores);
router.post("/:id/scores", requireRole("staff"), ctrl.upsertJudgeScore);
router.delete("/:id/scores", requireRole("staff"), ctrl.deleteMyJudgeScore);

module.exports = router;
