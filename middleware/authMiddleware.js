const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Protect routes - verify JWT token
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id).select("-password");

      if (!req.user) {
        return res
          .status(401)
          .json({ success: false, message: "User not found" });
      }

      // Normalize legacy roles in-memory so authorization and filtering behave consistently.
      // (Old databases may still contain these values.)
      if (req.user.role === "custodian" || req.user.role === "handler") {
        req.user.role = "employee";
      }

      if (!req.user.isActive) {
        return res
          .status(401)
          .json({ success: false, message: "User account is inactive" });
      }

      next();
    } catch (error) {
      console.error(error);
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "Not authorized, no token" });
  }
};

// Authorize roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please log in.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

// Check if user owns the resource or is admin
exports.checkOwnership = (Model) => {
  return async (req, res, next) => {
    try {
      const resource = await Model.findById(req.params.id);

      if (!resource) {
        return res.status(404).json({
          success: false,
          message: "Resource not found",
        });
      }

      // Admin can access everything
      if (req.user.role === "admin") {
        req.resource = resource;
        return next();
      }

      // Check if user owns the resource (submittedBy or requestedBy)
      const isOwner =
        resource.submittedBy?.toString() === req.user._id.toString() ||
        resource.requestedBy?.toString() === req.user._id.toString();

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to access this resource",
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
};

// Check if user can approve transactions (approver or admin)
exports.canApprove = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Please log in.",
    });
  }

  const allowedRoles = ["admin", "approver", "manager"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Only admins, managers, and approvers can approve transactions",
    });
  }

  next();
};

// Check if user has read-only access (auditor can only view)
exports.readOnly = (req, res, next) => {
  if (req.user.role === "auditor" && req.method !== "GET") {
    return res.status(403).json({
      success: false,
      message: "Auditors have read-only access. Cannot modify data.",
    });
  }
  next();
};

// Check approval limit for approvers
exports.checkApprovalLimit = (transaction) => {
  return (req, res, next) => {
    if (req.user.role === "admin") {
      // Admin has unlimited approval authority
      return next();
    }

    if (req.user.role === "approver") {
      const txn = transaction || req.body;
      const amount = txn.postTaxAmount || txn.amount;

      if (req.user.approvalLimit && amount > req.user.approvalLimit) {
        return res.status(403).json({
          success: false,
          message: `Amount ₹${amount} exceeds your approval limit of ₹${req.user.approvalLimit}. This requires admin approval.`,
        });
      }
    }

    next();
  };
};
