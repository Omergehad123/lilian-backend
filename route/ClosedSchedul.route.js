const express = require("express");
const router = express.Router();
const isCloseToday = require("../App/controllers/isTodayClosedContoller");
const verifyAdminToken = require("../App/middleware/verifyAdminToken");

router.get("/admin", verifyAdminToken, isCloseToday);

module.exports = router;
