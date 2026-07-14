const express = require("express");
const router = express.Router();
const { homeSummary } = require("../controllers/home.controller");

router.get("/summary", homeSummary);

module.exports = router;
