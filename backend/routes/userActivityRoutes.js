const express = require("express");
const router = express.Router();
const UserActivityLog = require("../models/UserActivityLog");
const { protect, authorize } = require("../middleware/authMiddleware");
const PDFDocument = require("pdfkit");
const {
  addPDFHeader,
  addPageHeader,
  addPDFFooter,
  LOGO_PATH,
} = require("../utils/pdfHeader");

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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=user-activity-log-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Add reusable header with logo
    const contentStartY = addPDFHeader(doc, "USER ACTIVITY LOG REPORT");

    // Report Info Box
    const infoBoxY = contentStartY + 5;
    const pageWidth = 595.28; // A4 width in points
    const margin = 40;
    const boxWidth = pageWidth - margin * 2;
    doc
      .rect(margin, infoBoxY, boxWidth, 50)
      .fillAndStroke("#f0f9ff", "#0077b6");

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
    const tableTop = infoBoxY + 70;
    const tableWidth = pageWidth - margin * 2;
    const colWidths = [85, 75, 110, 110, 135];
    const headers = [
      "Date & Time",
      "Action",
      "Target User",
      "Performed By",
      "Changes",
    ];

    // Header background
    doc.rect(margin, tableTop - 5, tableWidth, 22).fill("#023e8a");

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

        // Add page header with logo on new page
        const newPageY = addPageHeader(doc);

        // Re-add table headers
        const newTableTop = newPageY;
        doc.rect(margin, newTableTop - 5, tableWidth, 22).fill("#023e8a");
        xPos = margin + 5;
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
        doc.rect(margin, yPos - 3, tableWidth, 20).fill("#f8fafc");
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

      xPos = margin + 5;
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
    doc
      .rect(margin, tableTop - 5, tableWidth, yPos - tableTop + 10)
      .stroke("#023e8a");

    // Add footer using utility function
    addPDFFooter(doc, req.user?.name || "System");

    doc.end();
  } catch (error) {
    console.error("PDF export error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// @desc    Clear all activity logs
// @route   DELETE /api/user-activity/clear-all
// @access  Private (Admin only)
router.delete("/clear-all", protect, authorize("admin"), async (req, res) => {
  try {
    await UserActivityLog.deleteMany({});
    res
      .status(200)
      .json({ success: true, message: "All activity logs cleared" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Delete a single activity log entry
// @route   DELETE /api/user-activity/:id
// @access  Private (Admin only)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const log = await UserActivityLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res
        .status(404)
        .json({ success: false, message: "Activity log not found" });
    }
    res.status(200).json({ success: true, message: "Activity log deleted" });
  } catch (error) {
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
