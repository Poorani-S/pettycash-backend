const mongoose = require("mongoose");

const partPaymentSchema = new mongoose.Schema(
  {
    paymentDate: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than 0"],
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "upi", "card", "other"],
    },
    reference: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const approvalSchema = new mongoose.Schema(
  {
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["manager", "admin", "approver"], // Manager, Admin/CEO, or legacy approver
      required: true,
    },
    level: {
      type: Number, // 1 = Manager, 2 = Admin/CEO
      required: true,
      min: 1,
      max: 2,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    comments: {
      type: String,
      trim: true,
    },
    actionDate: {
      type: Date,
    },
  },
  { _id: false },
);

const transactionSchema = new mongoose.Schema(
  {
    transactionNumber: {
      type: String,
      unique: true,
      required: true,
    },
    // SOW Required Fields
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Please add a category"],
    },
    hasGSTInvoice: {
      type: Boolean,
      required: [true, "Please specify if GST invoice is available"],
      default: false,
    },
    transactionDate: {
      type: Date,
      required: [true, "Please add transaction date"],
      default: Date.now,
    },
    invoiceDate: {
      type: Date,
      required: [true, "Please add invoice date"],
    },
    payeeClientName: {
      type: String,
      required: [true, "Please add payee/client name"],
      trim: true,
      maxlength: [100, "Payee name cannot be more than 100 characters"],
    },
    purpose: {
      type: String,
      required: [true, "Please add purpose/description"],
      trim: true,
      maxlength: [500, "Purpose cannot be more than 500 characters"],
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
    preTaxAmount: {
      type: Number,
      required: [true, "Please add pre-tax amount"],
      min: [0.01, "Amount must be greater than 0"],
    },
    taxAmount: {
      type: Number,
      required: [true, "Please add tax amount"],
      default: 0,
      min: [0, "Tax amount cannot be negative"],
    },
    postTaxAmount: {
      type: Number,
      required: [true, "Please add post-tax amount"],
      min: [0.01, "Amount must be greater than 0"],
    },
    paymentDate: {
      type: Date,
      required: [true, "Please add payment date"],
    },
    partPayments: [partPaymentSchema], // Array for multiple part payments
    // File uploads
    invoiceImage: {
      type: String, // Store file path or URL for invoice scan
      default: null,
    },
    paymentProofImage: {
      type: String, // Store file path or URL for GPay/UPI screenshot
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "upi", "gpay", "paytm", "card", "other"],
      default: "cash",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    adminComment: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvals: [approvalSchema],
    rejectionReason: {
      type: String,
      trim: true,
    },
    paidDate: {
      type: Date,
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

// Generate transaction number before saving
transactionSchema.pre("save", async function (next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");

    // Find the last transaction number for this month
    const lastTransaction = await this.constructor
      .findOne({
        transactionNumber: new RegExp(`^PC${year}${month}`),
      })
      .sort({ transactionNumber: -1 });

    let sequence = 1;
    if (lastTransaction) {
      const lastSequence = parseInt(
        lastTransaction.transactionNumber.slice(-4),
      );
      sequence = lastSequence + 1;
    }

    this.transactionNumber = `PC${year}${month}${String(sequence).padStart(
      4,
      "0",
    )}`;
  }
  next();
});

// Index for faster queries
transactionSchema.index({ requestedBy: 1, status: 1 });
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ category: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
