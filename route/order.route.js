const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
} = require("../App/controllers/OrderController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken"); // ✅ NEW
const verifyToken = require("../App/middleware/verifyToken"); // Keep for Bearer
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// ✅ Use COOKIE auth for user routes
router.post("/", verifyCookieToken, createOrder); // ✅ FIXED
router.get("/", verifyCookieToken, getOrders); // ✅ FIXED
router.get("/:id", verifyCookieToken, getOrder); // ✅ FIXED

// Admin routes (keep Bearer for now)
router.get(
  "/admin/all",
  verifyToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  getAllOrders
);

router.patch(
  "/:id/status",
  verifyToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  updateOrderStatus
);

module.exports = router;
