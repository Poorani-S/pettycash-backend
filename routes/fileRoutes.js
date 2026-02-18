const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");
const { checkFileAccess } = require("../middleware/fileAccessMiddleware");

/**
 * @route   GET /api/files/invoices/:filename
 * @desc    Download invoice file (protected)
 * @access  Private (Admin, Manager, Owner only)
 */
router.get("/invoices/:filename", protect, checkFileAccess, (req, res) => {
  try {
    const fileName = req.params.filename;
    const filePath = path.join(
      __dirname,
      "..",
      "uploads",
      "invoices",
      fileName,
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error serving invoice file:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving file",
    });
  }
});

/**
 * @route   GET /api/files/payments/:filename
 * @desc    Download payment proof file (protected)
 * @access  Private (Admin, Manager, Owner only)
 */
router.get("/payments/:filename", protect, checkFileAccess, (req, res) => {
  try {
    const fileName = req.params.filename;
    const filePath = path.join(
      __dirname,
      "..",
      "uploads",
      "payments",
      fileName,
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error serving payment file:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving file",
    });
  }
});

/**
 * @route   GET /api/files/access-logs
 * @desc    Get file access audit logs (Admin only)
 * @access  Private (Admin only)
 */
router.get("/access-logs", protect, async (req, res) => {
  try {
    const { user } = req;

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const AuditLog = require("../models/AuditLog");
    const logs = await AuditLog.find({
      action: { $in: ["FILE_ACCESS", "UNAUTHORIZED_FILE_ACCESS"] },
    })
      .populate("user", "name email role")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching access logs:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving access logs",
    });
  }
});

module.exports = router;
