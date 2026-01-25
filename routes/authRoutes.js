const express = require("express");
const router = express.Router();
const {
  register,
  login,
  requestOTP,
  verifyOTP,
  getProfile,
  updateProfile,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// OTP-based authentication routes
router.post("/request-otp", requestOTP);
router.post("/verify-otp", verifyOTP);

// User management routes
router.post("/register", register); // Should be protected by admin middleware in production
router.post("/login", login); // Legacy route - redirects to OTP flow

// Protected routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

module.exports = router;
