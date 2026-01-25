const mongoose = require("mongoose");

const userActivityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ["created", "updated", "deleted", "deactivated", "reactivated", "role_changed"],
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUserName: {
      type: String,
      required: true,
    },
    targetUserEmail: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    performedByName: {
      type: String,
      required: true,
    },
    details: {
      previousData: {
        type: Object,
        default: {},
      },
      newData: {
        type: Object,
        default: {},
      },
      changes: {
        type: [String],
        default: [],
      },
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
userActivityLogSchema.index({ createdAt: -1 });
userActivityLogSchema.index({ action: 1 });
userActivityLogSchema.index({ targetUser: 1 });
userActivityLogSchema.index({ performedBy: 1 });

module.exports = mongoose.model("UserActivityLog", userActivityLogSchema);
