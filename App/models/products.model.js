const mongoose = require("mongoose");
const slugify = require("slugify");

const langString = {
  ar: { type: String, trim: true },
  en: { type: String, trim: true },
};

const productSchema = new mongoose.Schema(
  {
    name: langString,
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    category: langString,
    actualPrice: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
    },
    description: langString,
    preparation: langString,
    // Updated: Support both single URL (legacy) and multiple images array
    images: [
      {
        type: String, // URLs of uploaded images or legacy single image URL
      },
    ],
    image: {
      type: String, // Keep for backward compatibility (legacy single image)
    },
    quantity: {
      type: Number,
      default: 1,
    },
    dimensions: {
      width: langString,
      height: langString,
    },
    extras: [
      {
        type: String,
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Generate slug automatically from English name
productSchema.pre("save", function () {
  if (!this.name?.en) return;
  if (!this.isModified("name")) return;

  this.slug = slugify(this.name.en, {
    lower: true,
    strict: true,
    trim: true,
  });
});

module.exports = mongoose.model("Product", productSchema);
