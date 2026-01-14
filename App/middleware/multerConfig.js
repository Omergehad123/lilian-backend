const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const AppError = require("../../utils/appError");

// Ensure upload directory exists
const ensureUploadDir = async () => {
  const uploadDir = "uploads/products";
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    console.error("Error creating upload directory:", err);
  }
};

// Call once at startup
ensureUploadDir();

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      await fs.mkdir("uploads/products", { recursive: true });
      cb(null, "uploads/products/");
    } catch (err) {
      cb(err, null);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "product-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new AppError("Images only! (jpeg, jpg, png, gif)", 400), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per image
  },
  fileFilter,
});

module.exports = upload;
