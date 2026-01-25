const mongoose = require("mongoose");

const balanceSchema = new mongoose.Schema(
  {
    accountType: {
      type: String,
      enum: ["petty_cash_bank", "petty_cash_physical"],
      required: true,
      unique: true,
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },
    totalReceived: {
      type: Number,
      default: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Method to add funds
balanceSchema.methods.addFunds = function (amount, userId) {
  this.currentBalance += amount;
  this.totalReceived += amount;
  this.lastUpdated = new Date();
  this.updatedBy = userId;
  return this.save();
};

// Method to deduct funds
balanceSchema.methods.deductFunds = function (amount, userId) {
  if (this.currentBalance < amount) {
    throw new Error("Insufficient balance");
  }
  this.currentBalance -= amount;
  this.totalSpent += amount;
  this.lastUpdated = new Date();
  this.updatedBy = userId;
  return this.save();
};

module.exports = mongoose.model("Balance", balanceSchema);
