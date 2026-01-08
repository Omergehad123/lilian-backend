const express = require("express");
const router = express.Router();

const productsController = require("../App/controllers/ProductsContoller");
const verifyToken = require("../App/middleware/verifyToken");
const allowTo = require("../App/middleware/allowTo");
const userRoles = require("../utils/roles");

// public
router.get("/", productsController.getAllProducts);
router.get("/:slug", productsController.getProduct);

// protected
router.post(
  "/",
  verifyToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.addProducts
);

router.delete(
  "/:id",
  verifyToken,
  allowTo(userRoles.ADMIN),
  productsController.deleteProduct
);

router.patch(
  "/:id",
  verifyToken,
  allowTo(userRoles.ADMIN, userRoles.MANAGER),
  productsController.updateProduct
);

module.exports = router;
