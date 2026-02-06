const User = require("../models/User");
const OTP = require("../models/OTP");
const { generateToken } = require("../utils/jwtUtils");
const {
  generateOTP,
  sendOTPEmail,
  sendOTPSMS,
} = require("../services/otpService");

// Notification service for failed login alerts
let notifyAdminFailedLogin;
try {
  const notificationService = require("../services/notificationService");
  notifyAdminFailedLogin = notificationService.notifyAdminFailedLogin;
} catch (error) {
  console.warn("Notification service not fully available");
  notifyAdminFailedLogin = async () => ({ success: false });
}

// @desc    Login with password
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message:
          "Account is temporarily locked. Please try again later or use forgot password.",
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      // Increment failed password attempts
      user.failedPasswordAttempts = (user.failedPasswordAttempts || 0) + 1;
      user.lastFailedPasswordAttempt = new Date();

      // Check if exceeded 3 attempts
      if (user.failedPasswordAttempts >= 3) {
        await user.save();

        // Notify admin about failed login attempts
        if (notifyAdminFailedLogin) {
          await notifyAdminFailedLogin(user);
        }

        return res.status(401).json({
          success: false,
          message: `Invalid credentials. You have exceeded 3 failed attempts. Admin has been notified. You can try logging in with OTP instead.`,
          failedAttempts: user.failedPasswordAttempts,
          suggestOTP: true, // Flag to frontend to show OTP option
        });
      }

      await user.save();

      return res.status(401).json({
        success: false,
        message: `Invalid credentials. ${3 - user.failedPasswordAttempts} attempt(s) remaining before account notification.`,
        failedAttempts: user.failedPasswordAttempts,
      });
    }

    // Successful login - reset failed attempts
    user.failedPasswordAttempts = 0;
    user.accountLockedUntil = null;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        bankDetails: user.bankDetails,
        token: token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Request OTP for forgot password / login
// @route   POST /api/auth/request-otp
// @access  Public
exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address",
      });
    }

    // Check if user exists and is active
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please contact administrator.",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is inactive. Please contact administrator.",
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message:
          "Account is temporarily locked due to multiple failed attempts. Please try again later.",
      });
    }

    // Rate limiting: Check last OTP sent time
    if (user.lastOTPSentAt) {
      const timeSinceLastOTP = Date.now() - user.lastOTPSentAt.getTime();
      const cooldownPeriod = 60 * 1000; // 1 minute cooldown

      if (timeSinceLastOTP < cooldownPeriod) {
        const remainingSeconds = Math.ceil(
          (cooldownPeriod - timeSinceLastOTP) / 1000,
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${remainingSeconds} seconds before requesting another OTP`,
        });
      }
    }

    // Generate OTP
    const otpCode = generateOTP();

    // Delete any existing OTPs for this user
    await OTP.deleteMany({ userId: user._id, otpType: "login" });

    // Save OTP to database
    await OTP.create({
      userId: user._id,
      email: user.email,
      phone: user.phone,
      otp: otpCode,
      otpType: "login",
    });

    // Update last OTP sent time
    user.lastOTPSentAt = new Date();
    await user.save();

    // Send OTP via email
    try {
      await sendOTPEmail(user.email, otpCode, user.name);

      // Optionally send SMS as well
      if (user.phone && process.env.SMS_ENABLED === "true") {
        await sendOTPSMS(user.phone, otpCode, user.name);
      }

      res.status(200).json({
        success: true,
        message: "OTP sent successfully to your registered email",
        data: {
          email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Mask email
          expiresIn: 600, // 10 minutes in seconds
        },
      });
    } catch (emailError) {
      console.error("Error sending OTP:", emailError);
      return res.status(500).json({
        success: false,
        message:
          "Failed to send OTP. Please try again or contact administrator.",
      });
    }
  } catch (error) {
    console.error("Request OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Verify OTP and login
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate input
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if account is locked
    if (user.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        message: "Account is temporarily locked. Please try again later.",
      });
    }

    // Find valid OTP
    const otpRecord = await OTP.findOne({
      userId: user._id,
      otpType: "login",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired or is invalid. Please request a new one.",
      });
    }

    // Increment attempt counter
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Check if OTP matches
    if (otpRecord.otp !== otp) {
      // Check if max attempts reached
      if (otpRecord.attempts >= 5) {
        // Lock account for 15 minutes
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        user.failedOTPAttempts += 1;
        await user.save();

        return res.status(423).json({
          success: false,
          message: "Too many failed attempts. Account locked for 15 minutes.",
        });
      }

      user.failedOTPAttempts += 1;
      await user.save();

      return res.status(401).json({
        success: false,
        message: `Invalid OTP. ${5 - otpRecord.attempts} attempts remaining.`,
      });
    }

    // OTP is valid - mark as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Reset failed attempts (both password and OTP)
    user.failedOTPAttempts = 0;
    user.failedPasswordAttempts = 0;
    user.accountLockedUntil = null;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Return user data with token
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        token: token,
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register new user (Admin only)
// @route   POST /api/auth/register
// @access  Private/Admin
exports.register = async (req, res) => {
  try {
    const { name, email, phone, role, department, password } = req.body;

    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, and phone number",
      });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    // Create user with optional password
    const userData = {
      name,
      email,
      phone,
      role: role || "employee",
      department,
      otpEnabled: true,
      createdBy: req.user ? req.user._id : null,
    };

    // Add password if provided
    if (password && password.trim()) {
      userData.password = password;
    }

    const user = await User.create(userData);

    // Return user data (no token on registration)
    res.status(201).json({
      success: true,
      message: `User created successfully. They can login using ${userData.password ? "password or" : ""} OTP.`,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        hasPassword: user.hasPassword,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "managerId",
      "name email",
    );

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, department } = req.body;

    const user = await User.findById(req.user._id);

    if (user) {
      user.name = name || user.name;
      user.phone = phone || user.phone;
      user.department = department || user.department;

      const updatedUser = await user.save();

      res.status(200).json({
        success: true,
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          department: updatedUser.department,
          phone: updatedUser.phone,
        },
      });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    // Check current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
