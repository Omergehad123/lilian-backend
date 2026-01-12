require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const httpStatusText = require("./utils/httpStatusText");

const app = express();
const upload = multer({ dest: "./Uploads/" });

// ======== Environment Variables ========
const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DB_URL;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173"];

// ======== Database ========
mongoose
  .connect(DB_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ======== CRITICAL: WEBHOOK ROUTES FIRST (BEFORE JSON PARSER) ========
const paymentRouter = require("./route/paymentRoutes"); // Load payment routes early
app.use("/api/payment/webhook", paymentRouter); // Raw webhook endpoint

// ======== Middleware (AFTER webhook) ========
// CORS setup
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://lilyandelarosekw.com",
    ],
    credentials: true,
  })
);

// Parse JSON (AFTER webhook)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static files
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));
app.set("trust proxy", 1);

// Cookie parser
const cookieParser = require("cookie-parser");
app.use(cookieParser());

// ======== ALL ROUTES (AFTER middleware) ========
const productsRouter = require("./route/products.route");
const usersRouter = require("./route/users.route");
const orderRouter = require("./route/order.route");
const cityAreaRoutes = require("./route/cityAreaRoutes");
const promoRoute = require("./route/promos");

// === Remove any Google sign-in related code here - nothing present ===
// All other routers
app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);
app.use("/api/payment", paymentRouter); // Normal payment routes
app.use("/api/orders", orderRouter);
app.use("/api/city-areas", cityAreaRoutes);
app.use("/api/promos", promoRoute);

// Promo restore endpoint
app.post("/api/promos/:code/restore", async (req, res) => {
  try {
    const { code } = req.params;
    const { orderId } = req.body;

    const Promo = mongoose.model("Promo");
    const promo = await Promo.findOne({ code: code.toUpperCase() });
    if (!promo) {
      return res.status(404).json({ message: "Promo code not found" });
    }

    promo.usageCount = Math.max(0, promo.usageCount - 1);
    if (promo.usedBy && req.user?.id) {
      promo.usedBy = promo.usedBy.filter((userId) => userId !== req.user.id);
    }

    await promo.save();

    console.log(
      `✅ Promo ${code} restored after order ${orderId} cancellation`
    );
    res.json({
      message: "Promo restored successfully",
      promo: {
        code: promo.code,
        usageCount: promo.usageCount,
        maxUses: promo.maxUses,
      },
    });
  } catch (error) {
    console.error("Promo restore error:", error);
    res.status(500).json({ message: "Failed to restore promo" });
  }
});

// ======== 404 Handler ========
app.use((req, res, next) => {
  const error = new Error("This resource is not available");
  error.statusCode = 404;
  next(error);
});

// ======== Global Error Handler ========
app.use((error, req, res, next) => {
  console.error("GLOBAL ERROR:", error.message);

  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    status: httpStatusText.ERROR,
    message: error.message || "Something went wrong",
  });
});

// ======== Start Server ========
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📝 Webhook ready: http://localhost:${PORT}/api/payment/webhook/myfatoorah`
  );
});
