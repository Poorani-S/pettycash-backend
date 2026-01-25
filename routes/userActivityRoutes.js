const express = require("express");
const router = express.Router();
const UserActivityLog = require("../models/UserActivityLog");
const { protect, authorize } = require("../middleware/authMiddleware");
const PDFDocument = require("pdfkit");

// @desc    Get user activity logs
// @route   GET /api/user-activity
// @access  Private (Admin only)
router.get("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { action, targetUser, startDate, endDate, limit = 50 } = req.query;
    let query = {};

    if (action) query.action = action;
    if (targetUser) query.targetUser = targetUser;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await UserActivityLog.find(query)
      .populate("performedBy", "name email")
      .populate("targetUser", "name email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Export user activity logs as PDF
// @route   GET /api/user-activity/export/pdf
// @access  Private (Admin only)
router.get("/export/pdf", protect, authorize("admin"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await UserActivityLog.find(query)
      .populate("performedBy", "name email")
      .populate("targetUser", "name email role")
      .sort({ createdAt: -1 })
      .limit(100);

    // Create PDF
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    const path = require("path");
    const fs = require("fs");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=user-activity-log-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Add Kambaa Logo
    const logoPath = path.join(__dirname, "../../public/kambaa-logo.png");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 30, { width: 100 });
    }

    // Company Header
    doc
      .fontSize(18)
      .fillColor("#023e8a")
      .text("Kambaa Inc.", 150, 40, { align: "left" })
      .fontSize(10)
      .fillColor("#666")
      .text("Petty Cash Management System", 150, 62, { align: "left" });

    // Report Title
    doc
      .fontSize(16)
      .fillColor("#023e8a")
      .text("USER ACTIVITY LOG REPORT", 40, 100, { align: "center" })
      .moveDown(0.5);

    // Report Info Box
    const infoBoxY = 130;
    doc.rect(40, infoBoxY, 515, 50).fillAndStroke("#f0f9ff", "#0077b6");

    doc
      .fontSize(9)
      .fillColor("#023e8a")
      .text(
        `Report Period: ${startDate ? new Date(startDate).toLocaleDateString("en-IN") : "All Time"} - ${endDate ? new Date(endDate).toLocaleDateString("en-IN") : "Present"}`,
        50,
        infoBoxY + 10,
      )
      .text(
        `Generated On: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        50,
        infoBoxY + 25,
      )
      .text(`Total Activity Logs: ${logs.length}`, 300, infoBoxY + 10)
      .text(`Report Type: User Activity`, 300, infoBoxY + 25);

    // Table Header
    const tableTop = 195;
    const colWidths = [80, 80, 110, 110, 135];
    const headers = [
      "Date & Time",
      "Action",
      "Target User",
      "Performed By",
      "Changes",
    ];

    // Header background
    doc.rect(40, tableTop - 5, 515, 22).fill("#023e8a");

    let xPos = 45;
    doc.fontSize(8).fillColor("#ffffff");
    headers.forEach((header, i) => {
      doc.text(header, xPos, tableTop, {
        width: colWidths[i],
        align: "center",
      });
      xPos += colWidths[i];
    });

    // Table Rows
    let yPos = tableTop + 25;
    doc.fontSize(7);

    logs.forEach((log, index) => {
      // Check for page break
      if (yPos > 730) {
        doc.addPage();

        // Add logo on new page
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 20, { width: 60 });
        }
        doc
          .fontSize(10)
          .fillColor("#023e8a")
          .text("User Activity Log (Continued)", 110, 35);

        // Re-add table headers
        const newTableTop = 60;
        doc.rect(40, newTableTop - 5, 515, 22).fill("#023e8a");
        xPos = 45;
        doc.fontSize(8).fillColor("#ffffff");
        headers.forEach((header, i) => {
          doc.text(header, xPos, newTableTop, {
            width: colWidths[i],
            align: "center",
          });
          xPos += colWidths[i];
        });
        yPos = newTableTop + 25;
        doc.fontSize(7);
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(40, yPos - 3, 515, 20).fill("#f8fafc");
      }

      // Action color coding
      const actionColors = {
        created: "#10b981",
        updated: "#3b82f6",
        deleted: "#ef4444",
        deactivated: "#f59e0b",
        reactivated: "#22c55e",
        role_changed: "#8b5cf6",
      };

      xPos = 45;
      const rowData = [
        new Date(log.createdAt).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        log.action.toUpperCase(),
        `${log.targetUserName}\n${log.targetUserEmail}`,
        log.performedByName || "System",
        (log.details?.changes?.join(", ") || "—").substring(0, 45),
      ];

      rowData.forEach((data, i) => {
        if (i === 1) {
          // Action column - color coded
          doc.fillColor(actionColors[log.action] || "#333");
        } else {
          doc.fillColor("#333");
        }

        doc.text(data, xPos, yPos, {
          width: colWidths[i],
          align: i === 1 ? "center" : "left",
          lineBreak: i === 2, // Allow line break for target user
        });
        xPos += colWidths[i];
      });

      yPos += 20;
    });

    // Draw table border
    doc.rect(40, tableTop - 5, 515, yPos - tableTop + 10).stroke("#023e8a");

    // Footer
    doc
      .fontSize(8)
      .fillColor("#666")
      .text("---", 40, yPos + 15, { align: "center" })
      .text(
        "This is a system-generated report from Kambaa Petty Cash Management System",
        40,
        yPos + 28,
        { align: "center" },
      )
      .text(
        `Generated by: ${req.user?.name || "System"} | Date: ${new Date().toLocaleString("en-IN")}`,
        40,
        yPos + 40,
        { align: "center" },
      )
      .fontSize(7)
      .fillColor("#999")
      .text("Confidential - For Internal Use Only", 40, yPos + 55, {
        align: "center",
      });

    doc.end();
  } catch (error) {
    console.error("PDF export error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper function to log user activity (exported for use in other controllers)
const logUserActivity = async (
  action,
  targetUser,
  performedBy,
  details = {},
) => {
  try {
    await UserActivityLog.create({
      action,
      targetUser: targetUser._id,
      targetUserName: targetUser.name,
      targetUserEmail: targetUser.email,
      performedBy: performedBy._id,
      performedByName: performedBy.name,
      details,
    });
  } catch (error) {
    console.error("Error logging user activity:", error);
  }
};

router.logUserActivity = logUserActivity;

module.exports = router;
