const fs = require('fs');
const path = require('path');

const folderPath = 'D:/Programing/FronEnd/WEBSITES/lilian-website/react-app/public/products/products'; // حط هنا مسار الفولدر اللي فيه الصور

fs.readdir(folderPath, (err, files) => {
  if (err) {
    console.error('Error reading folder:', err);
    return;
  }

  files.forEach(file => {
    const ext = path.extname(file); // .jpg, .png
    const name = path.basename(file, ext); // product-31
    const match = name.match(/product-(\d+)/); // ناخد الرقم من الاسم

    if (match) {
      const oldNumber = parseInt(match[1]);
      const newNumber = oldNumber - 1; // نطرح 1
      const newName = `product-${newNumber}${ext}`;
      const oldPath = path.join(folderPath, file);
      const newPath = path.join(folderPath, newName);

      fs.rename(oldPath, newPath, (err) => {
        if (err) console.error('Error renaming file:', err);
        else console.log(`${file} renamed to ${newName}`);
      });
    }
  });
});
