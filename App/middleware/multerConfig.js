const multer = require("multer");
const crypto = require("crypto");
const { Blob } = require("buffer");
const fetch = require("node-fetch");
const path = require("path");

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif/;
  if (filetypes.test(file.mimetype) && filetypes.test(path.extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error("Images only!"), false);
  }
};

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

const uploadToCloudinary = async (buffer) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  // ✅ MANUAL SIGNATURE
  const paramsStr = `folder=lilian-products&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha1', apiSecret).update(paramsStr).digest('hex');

  // ✅ CREATE REAL BUFFER/BLOB
  const blob = new Blob([buffer], { type: 'image/jpeg' });
  const filename = `upload-${timestamp}.jpg`;

  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', 'lilian-products');

  console.log("📤 Uploading with signature:", signature.substring(0, 8) + '...');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("❌ CLOUDINARY ERROR:", result);
    throw new Error(result.error?.message || 'Upload failed');
  }

  console.log("✅ UPLOAD SUCCESS:", result.secure_url);
  return result.secure_url;
};

module.exports = { upload, uploadToCloudinary };
