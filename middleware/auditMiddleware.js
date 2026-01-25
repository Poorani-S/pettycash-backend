const AuditLog = require("../models/AuditLog");

// Create audit log entry
const createAuditLog = async (
  action,
  performedBy,
  targetModel,
  targetId,
  changes = {},
  req = null
) => {
  try {
    await AuditLog.create({
      action,
      performedBy,
      targetModel,
      targetId,
      changes,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers["user-agent"],
      status: "success",
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
  }
};

// Middleware to log actions
exports.auditLog = (action, targetModel) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method
    res.json = function (data) {
      // Log if successful
      if (data.success !== false && req.user) {
        const targetId = data.data?._id || req.params.id || "unknown";
        createAuditLog(
          action,
          req.user._id,
          targetModel,
          targetId,
          data.data,
          req
        );
      }
      return originalJson(data);
    };

    next();
  };
};

module.exports.createAuditLog = createAuditLog;
