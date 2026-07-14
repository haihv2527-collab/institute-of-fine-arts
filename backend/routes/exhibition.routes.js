const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const ctrl = require("../controllers/exhibition.controller");

router.use(requireAuth);

router.get("/", ctrl.listExhibitions);
router.get("/:id", ctrl.getExhibition);
router.post("/", requireRole("staff"), ctrl.createExhibition);
router.put("/:id", requireRole("staff"), ctrl.updateExhibition);
router.delete("/:id", requireRole("staff"), ctrl.deleteExhibition);

router.get("/:id/paintings", ctrl.listExhibitionPaintings);
router.post("/:id/paintings", requireRole("staff"), ctrl.addPaintingToExhibition);
router.patch("/paintings/:paintingId", requireRole("staff"), ctrl.updateExhibitionPainting);
router.delete("/paintings/:paintingId", requireRole("staff"), ctrl.removePaintingFromExhibition);

module.exports = router;
