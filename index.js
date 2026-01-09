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

// ======== Middleware ========
// Parse JSON
app.use(express.json());

// Serve uploads
app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

// CORS setup
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ======== PASSPORT (NO SESSION for JWT) ========
const passport = require("./utils/passport");
app.use(passport.initialize());
// ✅ REMOVED: app.use(passport.session()); // No sessions for JWT

const cookieParser = require("cookie-parser");
app.use(cookieParser());
// ======== ROUTES ========
const productsRouter = require("./route/products.route");
const usersRouter = require("./route/users.route");
const paymentRouter = require("./route/paymentRoutes");
const orderRouter = require("./route/order.route");
const authRoutes = require("./route/authRoutes"); // ✅ Auth routes FIRST

app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/orders", orderRouter);
app.use("/api/auth", authRoutes); // ✅ Stateless JWT auth

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
});
