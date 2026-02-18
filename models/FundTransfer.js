const mongoose = require("mongoose");

const fundTransferSchema = new mongoose.Schema(
  {
    transferId: {
      type: String,
      unique: true,
      required: true,
    },
    transferType: {
      type: String,
      enum: ["bank", "cash"],
      required: true,
    },
    amount: {
      type: Number,
      required: [true, "Please add transfer amount"],
      min: [0.01, "Amount must be greater than 0"],
    },
    currency: {
      type: String,
      enum: ["INR", "USD", "EUR", "GBP", "AED", "SGD", "MYR"],
      default: "INR",
      required: true,
    },
    exchangeRate: {
      type: Number,
      default: 1, // Exchange rate to base currency (INR)
      min: [0.01, "Exchange rate must be positive"],
    },
    transferDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // Bank Transfer specific fields
    bankName: {
      type: String,
      trim: true,
    },
    fromAccount: {
      type: String,
      trim: true,
    },
    toAccount: {
      type: String,
      trim: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    // Cash Disbursement specific fields
    recipientName: {
      type: String,
      trim: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },
    acknowledgment: {
      type: String, // Signature or acknowledgment note
      trim: true,
    },
    // Common fields
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    purpose: {
      type: String,
      trim: true,
      maxlength: [500, "Purpose cannot be more than 500 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "completed",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Generate unique transfer ID
fundTransferSchema.pre("save", async function (next) {
  if (!this.transferId) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const count = await this.constructor.countDocuments();
    this.transferId = `FT${year}${month}${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

module.exports = mongoose.model("FundTransfer", fundTransferSchema);
