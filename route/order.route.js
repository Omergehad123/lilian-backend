const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
} = require("../App/controllers/OrderController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken");
const verifyAdminToken = require("../App/middleware/verifyAdminToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// ✅ GUESTS CAN CREATE ORDERS (No auth required for creation)
router.post("/", createOrder);

// AUTH REQUIRED for user orders
router.get("/", verifyCookieToken, getOrders);
router.get("/:id", verifyCookieToken, getOrder);
router.delete("/:id", verifyCookieToken, deleteOrder);

// ADMIN ROUTES
router.get("/admin/all", verifyAdminToken, allowTo(userRoles.ADMIN, userRoles.MANAGER), getAllOrders);
router.patch("/:id/status", verifyAdminToken, allowTo(userRoles.ADMIN, userRoles.MANAGER), updateOrderStatus);

module.exports = router;
