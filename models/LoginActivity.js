const mongoose = require("mongoose");

const loginActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    loginMethod: {
      type: String,
      enum: ["password", "otp"],
      required: true,
    },
    loginStatus: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    failureReason: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
loginActivitySchema.index({ user: 1, timestamp: -1 });
loginActivitySchema.index({ loginStatus: 1, timestamp: -1 });
loginActivitySchema.index({ timestamp: -1 });

module.exports = mongoose.model("LoginActivity", loginActivitySchema);
