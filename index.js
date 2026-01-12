require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const httpStatusText = require("./utils/httpStatusText");
const app = express();
const upload = multer({ dest: "./Uploads/" });
const OrderController = require("./App/controllers/OrderController");

// ✅ CRON DISABLED - FIXES THE ERROR
console.log("⏰ CRON DISABLED - Store hours testing mode ✅");

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

// ======== Middleware ========
// Parse JSON
app.use(express.json());

// Serve uploads
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

// CORS setup
app.use(
  cors({
    origin: [
      "https://diaa-sallam.com",
      "http://localhost:5173",
      "http://localhost:5174",
      "https://lilyandelarosekw.com",
    ],
    credentials: true,
  })
);

app.set("trust proxy", 1);

// ======== PASSPORT (NO SESSION for JWT) ========
const passport = require("./utils/passport");
app.use(passport.initialize());

const cookieParser = require("cookie-parser");
app.use(cookieParser());

// ======== ROUTES ========
const productsRouter = require("./route/products.route");
const usersRouter = require("./route/users.route");
const paymentRouter = require("./route/paymentRoutes");
const orderRouter = require("./route/order.route");
const authRoutes = require("./route/authRoutes");
const cityAreaRoutes = require("./route/cityAreaRoutes");
const promoRoute = require("./route/promos");

app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/orders", orderRouter);
app.use("/api/auth", authRoutes);
app.use("/api/city-areas", cityAreaRoutes);
app.use("/api/promos", promoRoute);

app.post("/api/promos/:code/restore", async (req, res) => {
  try {
    const { code } = req.params;
    const { orderId } = req.body;

    const Promo = mongoose.model("Promo") || require("./models/Promo");

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
  console.log("✅ Store hours testing READY!");
});
