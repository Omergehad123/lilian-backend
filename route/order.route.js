const express = require("express");
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrder,
  getAllOrders,
  updateOrderStatus,
  deleteOrder,
  getPendingOrders,
  checkAndSendNotifications,
  updateAdminStartTime, // ✅ IMPORTED
} = require("../App/controllers/OrderController");
const verifyCookieToken = require("../App/middleware/verifyCookieToken");
const verifyToken = require("../App/middleware/verifyToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// ✅ CUSTOMER ROUTES (COOKIE AUTH)
router.post("/", verifyCookieToken, createOrder);
router.get("/", verifyCookieToken, getOrders);
router.get("/:id", verifyCookieToken, getOrder);
router.delete("/:id", verifyCookieToken, deleteOrder); // ✅ DELETE ROUTE ADDED HERE

// ✅ ADMIN ROUTES (BEARER TOKEN)
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

router.get("/admin/pending", verifyToken, allowTo(userRoles.ADMIN), getPendingOrders);
router.patch(
  "/admin/start-time",
  verifyToken,
  allowTo(userRoles.ADMIN),
  updateAdminStartTime
);
router.get(
  "/admin/check-notifications",
  verifyToken,
  allowTo(userRoles.ADMIN),
  checkAndSendNotifications
);

module.exports = router;
