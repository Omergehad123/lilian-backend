const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const path = require("path");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timestamp: Math.floor(Date.now() / 1000),
});

// Memory storage (no disk needed for Render)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Images only! (jpeg, jpg, png, gif)"), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "lilian-products",
        resource_type: "image",
        transformation: "c_limit,h_1000,w_1000/q_auto", // ✅ STRING like error shows
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary FULL ERROR:", JSON.stringify(error, null, 2));
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};


module.exports = {
  upload,
  uploadToCloudinary, // ✅ EXPORTED CORRECTLY
  cloudinary,
};
