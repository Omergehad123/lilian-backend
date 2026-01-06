const httpStatusText = require("./utils/httpStatusText");
const express = require("express");
const app = express();
const path = require("path");
const multer = require("multer");
const upload = multer({ dest: "./Uploads/" });
const cors = require("cors");

app.use("/Uploads", express.static(path.join(__dirname, "Uploads")));

require("dotenv").config();
const url = process.env.DB_URL;

// database
const mongoose = require("mongoose");
mongoose.connect(url).then(() => console.log("Connected to MongoDB"));

// middleware
app.use(cors());
app.use(express.json());

// routes
const productsRouter = require("./route/products.route");
const usersRouter = require("./route/users.route");

app.use("/api/products", productsRouter);
app.use("/api/users", usersRouter);

// 404 handler (no "*")
app.use((req, res, next) => {
  const error = new Error("this resource not available");
  error.statusCode = 404;
  next(error);
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("GLOBAL ERROR:", error);

  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    status: httpStatusText.ERROR,
    message: error.message || "Something went wrong",
  });
});

app.listen(process.env.PORT || 5000, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
