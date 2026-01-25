const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a category name"],
      unique: true,
      trim: true,
      maxlength: [50, "Category name cannot be more than 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot be more than 200 characters"],
    },
    code: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      required: [true, "Please add a category code"],
    },
    budgetLimit: {
      type: Number,
      default: 0,
      min: [0, "Budget limit cannot be negative"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Category", categorySchema);
