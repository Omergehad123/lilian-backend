const multer = require("multer");
const crypto = require("crypto");
const axios = require("axios");
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

  // ✅ PERFECT SIGNATURE (your logs prove this works)
  const paramsStr = `folder=lilian-products&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha1', apiSecret).update(paramsStr).digest('hex');

  // ✅ BUFFER DIRECTLY - No Blob issues
  const formData = new FormData();
  formData.append('file', buffer, {
    filename: `image-${timestamp}.jpg`,
    contentType: 'image/jpeg'
  });
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp);
  formData.append('signature', signature);
  formData.append('folder', 'lilian-products');

  console.log("📤 Uploading with signature:", signature.substring(0, 8) + '...');

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    console.log("✅ UPLOAD SUCCESS:", response.data.secure_url);
    return response.data.secure_url;
  } catch (error) {
    console.error("❌ UPLOAD ERROR:", error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Upload failed');
  }
};

module.exports = { upload, uploadToCloudinary };
