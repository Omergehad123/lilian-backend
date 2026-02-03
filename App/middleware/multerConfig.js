const multer = require("multer");
const crypto = require("crypto");
const fetch = require("node-fetch"); // You MUST npm install this
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

// ✅ DIRECT HTTP - BYPASSES ALL SDK ISSUES
const uploadToCloudinary = async (buffer) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  // ✅ MANUAL SIGNATURE - EXACT MATCH
  const paramsStr = `folder=lilian-products&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha1', apiSecret).update(paramsStr).digest('hex');

  // ✅ BASE64 UPLOAD
  const base64 = buffer.toString('base64');
  const mimeType = 'image/jpeg';
  const dataUri = `data:${mimeType};base64,${base64}`;

  const formData = new FormData();
  formData.append('file', dataUri, 'image.jpg');
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', 'lilian-products');

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(result.error));
  }

  console.log("✅ DIRECT UPLOAD:", result.secure_url);
  return result.secure_url;
};

module.exports = { upload, uploadToCloudinary };
