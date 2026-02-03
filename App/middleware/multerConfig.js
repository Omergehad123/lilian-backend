const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const path = require("path");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  if (filetypes.test(file.mimetype) && filetypes.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error("Images only!"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter
});

// ✅ PROVEN WORKING - Minimal config
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "lilian-products",
        resource_type: "image"
        // NO transformations = NO signature issues
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary ERROR:", error.message);
          reject(error);
        } else {
          console.log("✅ UPLOADED:", result.secure_url);
          resolve(result.secure_url);
        }
      }
    );

    // ✅ Simple pipe - works everywhere
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = { upload, uploadToCloudinary };
