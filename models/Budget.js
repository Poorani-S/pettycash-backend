const mongoose = require("mongoose");

const budgetSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    department: {
      type: String,
      required: [true, "Please add a department"],
      trim: true,
    },
    period: {
      month: {
        type: Number,
        required: true,
        min: 1,
        max: 12,
      },
      year: {
        type: Number,
        required: true,
      },
    },
    allocatedAmount: {
      type: Number,
      required: [true, "Please add allocated amount"],
      min: [0, "Allocated amount cannot be negative"],
    },
    spentAmount: {
      type: Number,
      default: 0,
      min: [0, "Spent amount cannot be negative"],
    },
    remainingAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "exceeded", "exhausted"],
      default: "active",
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

// Calculate remaining amount before saving
budgetSchema.pre("save", function (next) {
  this.remainingAmount = this.allocatedAmount - this.spentAmount;

  // Update status based on spending
  if (this.spentAmount >= this.allocatedAmount) {
    this.status = "exhausted";
  } else if (this.spentAmount > this.allocatedAmount * 0.9) {
    this.status = "exceeded";
  } else {
    this.status = "active";
  }

  next();
});

// Compound index for unique budget per category, department, and period
budgetSchema.index(
  { category: 1, department: 1, "period.month": 1, "period.year": 1 },
  { unique: true }
);

module.exports = mongoose.model("Budget", budgetSchema);
