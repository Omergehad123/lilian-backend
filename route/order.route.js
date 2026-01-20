const express = require("express");
const router = express.Router();

const {
  createOrder,
  markOrderAsPaid,
  getOrders,
  getOrder,
  getAllOrders,
  getOrderByPaymentId,
  getOrderByInvoiceId,
} = require("../App/controllers/orderController");

const verifyCookieToken = require("../App/middleware/verifyCookieToken");
const verifyAdminToken = require("../App/middleware/verifyAdminToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// CREATE ORDER (guest + user)
router.post("/", createOrder);

// PAYMENT CALLBACK
router.post("/pay-success", markOrderAsPaid);

// USER
router.get("/", verifyCookieToken, getOrders);
router.get("/:id", getOrder);

// ADMIN
router.get(
  "/admin/all",
  verifyAdminToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  getAllOrders
);

// Get order by paymentId
router.get("/by-payment/:paymentId", getOrderByPaymentId);

// Get order by invoiceId
router.get("/by-invoice/:invoiceId", getOrderByInvoiceId);

module.exports = router;
