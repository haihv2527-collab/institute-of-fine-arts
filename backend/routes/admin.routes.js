const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const ctrl = require("../controllers/admin.controller");

router.use(requireAuth, requireRole("admin"));

router.get("/staff", ctrl.listStaff);
router.post("/staff", ctrl.createStaff);
router.put("/staff/:id", ctrl.updateStaff);
router.delete("/staff/:id", ctrl.deleteStaff);

router.get("/students", ctrl.listStudents);
router.post("/students", ctrl.createStudent);
router.put("/students/:id", ctrl.updateStudent);
router.delete("/students/:id", ctrl.deleteStudent);

module.exports = router;
