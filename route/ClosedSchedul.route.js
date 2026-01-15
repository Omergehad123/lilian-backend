const express = require("express");
const router = express.Router();
const isCloseToday = require("../App/controllers/isTodayClosedContoller");

router.get("/is-today-closed", isCloseToday); // ✅ /api/admin/is-today-closed

module.exports = router;
