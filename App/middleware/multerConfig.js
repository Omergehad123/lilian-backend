const multer = require("multer");
const crypto = require("crypto");
const FormData = require("form-data");
const fs = require("fs");
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
  // ✅ FORCE CORRECT TIMESTAMP (subtract Render's 1hr clock drift)
  const timestamp = Math.floor(Date.now() / 1000) - 3600;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  // ✅ UNSIGNED UPLOAD - NO SIGNATURE NEEDED
  const form = new FormData();
  form.append('file', buffer, {
    filename: `image-${timestamp}.jpg`,
    contentType: 'image/jpeg'
  });
  form.append('upload_preset', 'ml_default'); // Your unsigned preset
  form.append('folder', 'lilian-products');
  form.append('timestamp', timestamp);

  console.log("📤 UNSIGNED UPLOAD - timestamp:", timestamp);

  return new Promise((resolve, reject) => {
    const req = require('https').request({
      hostname: 'api.cloudinary.com',
      port: 443,
      path: `/v1_1/${cloudName}/image/upload`,
      method: 'POST',
      headers: form.getHeaders()
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log("✅ UNSIGNED SUCCESS:", result.secure_url);
            resolve(result.secure_url);
          } else {
            console.error("❌ UNSIGNED ERROR:", result);
            reject(new Error(result.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (err) {
          reject(new Error('Invalid response: ' + data));
        }
      });
    });

    req.on('error', reject);
    form.pipe(req);
  });
};


module.exports = { upload, uploadToCloudinary };
