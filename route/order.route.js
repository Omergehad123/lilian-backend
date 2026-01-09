const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder, // ✅ ADD THIS
} = require("../App/controllers/OrderController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken");
const verifyToken = require("../App/middleware/verifyToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// ✅ User routes (COOKIE auth)
router.post("/", verifyCookieToken, createOrder);
router.get("/", verifyCookieToken, getOrders);
router.get("/:id", verifyCookieToken, getOrder);

// 🔥 NEW DELETE ROUTE - CUSTOMER CAN DELETE OWN ORDERS
router.delete("/:id", verifyCookieToken, deleteOrder); // ✅ ADD THIS LINE

// Admin routes (Bearer token)
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
