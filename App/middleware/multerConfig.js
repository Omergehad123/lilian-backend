const multer = require("multer");
const crypto = require("crypto");
const FormData = require("form-data");
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

// ✅ MANUAL UPLOAD - NO SDK SIGNATURE ISSUES
const uploadToCloudinary = async (buffer) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  // ✅ GENERATE EXACT SIGNATURE
  const stringToSign = `folder=lilian-products&timestamp=${timestamp}`;
  const signature = crypto.createHmac('sha1', apiSecret).update(stringToSign).digest('hex');

  // ✅ BASE64 FILE
  const base64 = buffer.toString('base64');
  const mimeType = buffer.mime || 'image/jpeg';
  const dataUri = `data:${mimeType};base64,${base64}`;

  const form = new FormData();
  form.append('file', dataUri, { filename: 'image.jpg' });
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', 'lilian-products');

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error("CLOUDINARY RAW ERROR:", result);
      throw new Error(result.error?.message || 'Upload failed');
    }

    console.log("✅ MANUAL UPLOAD SUCCESS:", result.secure_url);
    return result.secure_url;
  } catch (error) {
    console.error("MANUAL UPLOAD FAILED:", error.message);
    throw error;
  }
};

module.exports = { upload, uploadToCloudinary };
