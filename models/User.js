const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add official email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Please add official phone number"],
      trim: true,
      match: [/^[\d\+\-\(\)\s]+$/, "Please add a valid phone number"],
    },
    // Password for all users - can be used for login (priority over OTP)
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    hasPassword: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: [
        "admin", // System Administrator - Full access, highest authority
        "ceo", // CEO - Top level authority (used by org hierarchy)
        "manager", // Manager - Reviews and approves employee expenses
        "employee", // Employee - Submits expenses to manager
        "intern", // Intern - Entry-level, reports to manager
        "approver", // Approver/Manager - Reviews and approves expenses (legacy)
        "auditor", // Auditor - View-only access for audits
      ],
      default: "employee",
    },
    department: {
      type: String,
      trim: true,
    },
    // For employees - links to their reporting manager
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      set: (value) => {
        if (value === "" || value === undefined) return null;
        if (typeof value === "string" && value.trim() === "") return null;
        return value;
      },
    },
    // For approvers/managers - defines approval authority limit
    approvalLimit: {
      type: Number,
      default: null, // null means unlimited (for admin)
    },
    // Bank Details
    bankDetails: {
      bankName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true, uppercase: true },
      accountHolderName: { type: String, trim: true },
      branchName: { type: String, trim: true },
    },
    // Additional user details
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    address: {
      type: String,
      trim: true,
    },
    employeeNumber: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    lastLogin: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // OTP-related fields
    otpEnabled: {
      type: Boolean,
      default: true, // OTP authentication is mandatory per SOW
    },
    lastOTPSentAt: {
      type: Date,
    },
    failedOTPAttempts: {
      type: Number,
      default: 0,
    },
    // Password login failed attempts
    failedPasswordAttempts: {
      type: Number,
      default: 0,
    },
    lastFailedPasswordAttempt: {
      type: Date,
    },
    accountLockedUntil: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin creates users
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  this.hasPassword = true;
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if account is locked
userSchema.methods.isAccountLocked = function () {
  return this.accountLockedUntil && this.accountLockedUntil > new Date();
};

module.exports = mongoose.model("User", userSchema);
