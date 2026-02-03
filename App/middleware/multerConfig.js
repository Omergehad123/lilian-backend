const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const path = require("path");

// ✅ FORCE CORRECT TIMESTAMP (bypasses Render clock issue)
const timestamp = Math.floor(Date.now() / 1000) - 3600; // Subtract 1hr offset

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timestamp: timestamp, // ✅ Locks current time
});

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

// ✅ ULTRA-SIMPLE: No transformations, no stream issues
const uploadToCloudinary = async (buffer) => {
  try {
    // Convert buffer to base64 Data URI (most reliable)
    const base64Data = buffer.toString('base64');
    const dataUri = `data:${buffer.mime || 'image/jpeg'};base64,${base64Data}`;

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        dataUri,
        {
          folder: "lilian-products",
          resource_type: "image",
          // ✅ NO transformations until basic upload works
        },
        (error, result) => {
          if (error) {
            console.error("CLOUDINARY ERROR:", JSON.stringify(error, null, 2));
            reject(error);
          } else {
            console.log("✅ UPLOAD SUCCESS:", result.secure_url);
            resolve(result.secure_url);
          }
        }
      );
    });

    return result.secure_url;
  } catch (error) {
    console.error("UPLOAD EXCEPTION:", error);
    throw error;
  }
};

module.exports = { upload, uploadToCloudinary, cloudinary };
