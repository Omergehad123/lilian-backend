const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

cloudinary.config({
  cloud_name: "dbfty465x",
  api_key: "421828491191588",
  api_secret: "GAFJ8MW9ZMN5hAtKgxQCteRMD70",
});

const imagesFolder = path.join(
  __dirname,
  "..",
  "..",
  "lilian-website",
  "react-app",
  "public",
  "products",
  "products"
);

if (!fs.existsSync(imagesFolder)) {
  console.error("Folder not found:", imagesFolder);
  process.exit(1);
}

const images = fs.readdirSync(imagesFolder);

images.forEach((imageFile) => {
  const filePath = path.join(imagesFolder, imageFile);
  
  // 🔥 استخراج الرقم من اسم الملف الأصلي
  const match = imageFile.match(/product-(\d+)/i);
  if (!match) {
    console.log(`⏭️ Skipping ${imageFile} (wrong format)`);
    return;
  }
  
  const originalNumber = parseInt(match[1]);
  const publicId = `product-${originalNumber}`;
  
  console.log(`📤 ${imageFile} → ${publicId} (keeping original #${originalNumber})`);

  cloudinary.uploader
    .upload(filePath, {
      public_id: publicId,
      folder: "products",
      overwrite: true,
    })
    .then((result) => {
      console.log(`✅ ${publicId}.jpg → ${result.secure_url}`);
    })
    .catch((err) => {
      console.error(`❌ ${publicId}:`, err.message);
    });
});
