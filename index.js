require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs").promises;
const cors = require("cors");
const httpStatusText = require("./utils/httpStatusText");
const verifyAdminToken = require("./App/middleware/verifyAdminToken");

const app = express();

// Create uploads directory
const ensureUploadDir = async () => {
  try {
    await fs.mkdir("uploads/products", { recursive: true });
    console.log("✅ Uploads directory ready");
  } catch (err) {
    console.error("❌ Uploads directory error:", err);
  }
};
ensureUploadDir();

const PORT = process.env.PORT || 5000;
const DB_URL = process.env.DB_URL;

// MongoDB connection
mongoose
  .connect(DB_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// CORS
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

app.get('/debug-time', (req, res) => {
  res.json({
    serverTime: new Date().toISOString(),
    unixTime: Math.floor(Date.now() / 1000),
    expectedString: `folder=lilian-products&timestamp=${Math.floor(Date.now() / 1000)}&transformation=c_limit,h_1000,w_1000/q_auto`
  });
});

// IMPORTANT: Webhook must be raw to validate signature
app.use(
  "/api/payment/webhook",
  express.raw({ type: "application/json" })
);

// Body parsers for other routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.set("trust proxy", 1);

const cookieParser = require("cookie-parser");
app.use(cookieParser());

// Routes
const ClosedSchedul = require("./route/ClosedSchedul.route");
const productsRouter = require("./route/products.route");
const usersRouter = require("./route/users.route");
const orderRouter = require("./route/order.route");
const cityAreaRoutes = require("./route/cityAreaRoutes");
const promoRoute = require("./route/promos");
const paymentRouter = require("./route/paymentRoutes");

app.use("/api/admin", ClosedSchedul);
app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/orders", orderRouter);
app.use("/api/city-areas", cityAreaRoutes);
app.use("/api/promos", promoRoute);

// Schedule Routes
app.get("/api/admin/is-today-closed", async (req, res) => {
  try {
    const ClosedSchedule = require("./App/models/ClosedSchedule");
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    const isClosed = await ClosedSchedule.findOne({ date: todayString });
    const currentHour = new Date().getHours();
    const timeBasedClosed = currentHour >= 21;

    res.json({
      isClosed: !!isClosed || timeBasedClosed,
      date: todayString,
      timeBasedClosed,
      manuallyClosed: !!isClosed,
    });
  } catch (error) {
    console.error("Check closed error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.post("/api/admin/open-today-schedule", async (req, res) => {
  try {
    const ClosedSchedule = require("./App/models/ClosedSchedule");
    const today = new Date();
    const todayString = today.toISOString().split("T")[0];

    await ClosedSchedule.deleteOne({ date: todayString });

    res.json({
      success: true,
      message: `Today's schedule (${todayString}) opened successfully`,
      closedDate: null,
    });
  } catch (error) {
    console.error("Open schedule error:", error);
    res.status(500).json({ success: false, message: "Failed to open schedule" });
  }
});

app.post(
  "/api/admin/close-today-schedule",
  verifyAdminToken,
  async (req, res) => {
    try {
      const ClosedSchedule = require("./App/models/ClosedSchedule");
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];

      await ClosedSchedule.create({
        date: todayString,
        closedBy: req.user.id,
        closedAt: new Date(),
      });

      res.json({
        success: true,
        message: `Today's schedule (${todayString}) closed successfully`,
        closedDate: todayString,
      });
    } catch (error) {
      console.error("Close schedule error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to close schedule" });
    }
  }
);

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

// 404 Handler
app.use((req, res, next) => {
  const error = new Error("This resource is not available");
  error.statusCode = 404;
  next(error);
});

// Global Error Handler
app.use((error, req, res, next) => {
  console.error("GLOBAL ERROR:", error.message);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    status: httpStatusText.ERROR,
    message: error.message || "Something went wrong",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
