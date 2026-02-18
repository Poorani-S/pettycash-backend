const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");

/**
 * File Access Control Middleware
 * Hierarchy: Admin > Manager > Employee
 *
 * Rules:
 * - Admin: Can access all files
 * - Manager: Can access all files (logged for audit)
 * - Employee: Can only access their own transaction files
 */

const checkFileAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const fileName = req.params.filename;

    if (!user || !fileName) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    // Admin has full access - no restrictions
    if (user.role === "admin") {
      // Log admin file access
      await AuditLog.create({
        user: user._id,
        action: "FILE_ACCESS",
        details: `Admin accessed file: ${fileName}`,
        ipAddress: req.ip,
      });
      return next();
    }

    // Manager has full access - logged for audit
    if (user.role === "manager") {
      // Log manager file access for compliance
      await AuditLog.create({
        user: user._id,
        action: "FILE_ACCESS",
        details: `Manager accessed file: ${fileName}`,
        ipAddress: req.ip,
      });
      return next();
    }

    // Employees can only access their own files
    // Find transaction that has this file
    const transaction = await Transaction.findOne({
      $or: [
        { invoiceImage: { $regex: fileName } },
        { paymentProofImage: { $regex: fileName } },
      ],
    }).populate("submittedBy user requestedBy");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "File not found or access denied",
      });
    }

    // Check if employee owns this transaction
    const isOwner =
      transaction.submittedBy?._id?.toString() === user._id.toString() ||
      transaction.user?._id?.toString() === user._id.toString() ||
      transaction.requestedBy?._id?.toString() === user._id.toString();

    if (!isOwner) {
      // Log unauthorized access attempt
      await AuditLog.create({
        user: user._id,
        action: "UNAUTHORIZED_FILE_ACCESS",
        details: `Employee attempted to access file: ${fileName}`,
        ipAddress: req.ip,
      });

      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own transaction files.",
      });
    }

    // Log successful employee file access
    await AuditLog.create({
      user: user._id,
      action: "FILE_ACCESS",
      details: `Employee accessed own file: ${fileName}`,
      ipAddress: req.ip,
    });

    next();
  } catch (error) {
    console.error("File access check error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking file access permissions",
    });
  }
};

module.exports = { checkFileAccess };
