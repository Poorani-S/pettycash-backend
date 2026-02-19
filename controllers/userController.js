const User = require("../models/User");
const UserActivityLog = require("../models/UserActivityLog");

// Notification service - load only if available
let sendUserInvitation;
try {
  const notificationService = require("../services/notificationService");
  sendUserInvitation = notificationService.sendUserInvitation;
} catch (error) {
  console.warn("Notification service not available:", error.message);
  sendUserInvitation = async () => ({ success: false });
}

// Helper function to log user activity
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

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin, Manager)
exports.getUsers = async (req, res) => {
  try {
    const { role, department, isActive } = req.query;

    let query = {};
    if (role) query.role = role;
    if (department) query.department = department;
    if (isActive !== undefined) query.isActive = isActive === "true";

    // If user is a manager, only show their team members and themselves
    if (req.user.role === "manager") {
      query.$or = [
        { managerId: req.user._id }, // Employees under this manager
        { _id: req.user._id }, // The manager themselves
      ];
    }

    const users = await User.find(query)
      .populate("managerId", "name email")
      .populate("createdBy", "name email")
      .select("-password")
      .sort({ name: 1 });

    // Map legacy custodian/handler roles to employee
    const mappedUsers = users.map((user) => {
      const userObj = user.toObject();
      if (userObj.role === "custodian" || userObj.role === "handler") {
        userObj.role = "employee";
      }
      return userObj;
    });

    res.status(200).json({
      success: true,
      count: mappedUsers.length,
      data: mappedUsers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private (Admin, Manager)
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("managerId", "name email")
      .select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Map legacy custodian/handler roles to employee
    const userObj = user.toObject();
    if (userObj.role === "custodian" || userObj.role === "handler") {
      userObj.role = "employee";
    }

    res.status(200).json({
      success: true,
      data: userObj,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin, Manager - own team only)
exports.updateUser = async (req, res) => {
  try {
    const {
      name,
      email,
      role,
      department,
      phone,
      managerId,
      isActive,
      employeeNumber,
      bankDetails,
      panNumber,
      address,
    } = req.body;

    let user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check authorization based on user role
    if (req.user.role === "manager") {
      // Managers can only update employees and interns from their team
      if (user.role !== "employee" && user.role !== "intern") {
        return res.status(403).json({
          success: false,
          message: "Managers can only update employees and interns",
        });
      }
      if (user.managerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "You can only update employees and interns from your own team",
        });
      }
      // Managers cannot change roles to anything other than employee or intern
      if (role && role !== "employee" && role !== "intern") {
        return res.status(403).json({
          success: false,
          message: "Managers can only assign employee or intern roles",
        });
      }
    }

    // Track changes for logging
    const changes = [];
    const previousData = {
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      isActive: user.isActive,
    };

    if (name && name !== user.name)
      changes.push(`Name: ${user.name} → ${name}`);
    if (email && email !== user.email)
      changes.push(`Email: ${user.email} → ${email}`);
    if (role && role !== user.role)
      changes.push(`Role: ${user.role} → ${role}`);
    if (department && department !== user.department)
      changes.push(`Department: ${user.department || "N/A"} → ${department}`);
    if (isActive !== undefined && isActive !== user.isActive)
      changes.push(
        `Status: ${user.isActive ? "Active" : "Inactive"} → ${isActive ? "Active" : "Inactive"}`,
      );

    const updateData = {};

    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Never allow empty-string ObjectId values (can cause CastError)
    if (managerId !== undefined) {
      if (typeof managerId === "string" && managerId.trim() === "") {
        updateData.managerId = null;
      } else {
        updateData.managerId = managerId;
      }
    }
    if (bankDetails) updateData.bankDetails = bankDetails;
    if (panNumber) updateData.panNumber = panNumber;
    if (address) updateData.address = address;

    user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    // Log the update activity
    if (changes.length > 0) {
      const action =
        role && role !== previousData.role ? "role_changed" : "updated";
      await logUserActivity(action, user, req.user, {
        previousData,
        newData: { name, email, role, department, isActive },
        changes,
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin, Manager)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check authorization based on user role
    if (req.user.role === "manager") {
      // Managers can only delete employees and interns from their team
      if (user.role !== "employee" && user.role !== "intern") {
        return res.status(403).json({
          success: false,
          message: "Managers can only delete employees and interns",
        });
      }
      if (user.managerId?.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "You can only delete employees and interns from your own team",
        });
      }
    }

    // Prevent deletion of the only admin
    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete the only admin user",
        });
      }
    }

    // Log deletion before deleting
    await logUserActivity("deleted", user, req.user, {
      previousData: { name: user.name, email: user.email, role: user.role },
      changes: ["User account deleted"],
    });

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new user with invitation
// @route   POST /api/users
// @access  Private (Admin, Manager)
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      approvalLimit,
      bankDetails,
      panNumber,
      address,
      password,
      managerId,
      employeeNumber,
    } = req.body;

    // Check authorization based on user role
    if (req.user.role === "manager") {
      // Managers can only create employees and interns under them
      if (role && role !== "employee" && role !== "intern") {
        return res.status(403).json({
          success: false,
          message: "Managers can only create employees and interns",
        });
      }
      // Auto-assign the manager as the creator
      if (managerId && managerId !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message:
            "Managers can only add employees and interns to their own team",
        });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Determine the manager ID
    let assignedManagerId = managerId;
    if (
      req.user.role === "manager" &&
      (role === "employee" || role === "intern")
    ) {
      // Auto-assign manager to their own ID
      assignedManagerId = req.user._id;
    }

    // Normalize empty/blank managerId to null to avoid ObjectId cast issues
    if (typeof assignedManagerId === "string" && assignedManagerId.trim() === "") {
      assignedManagerId = null;
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password: password || undefined,
      role: role || "employee",
      department,
      approvalLimit: role === "approver" ? approvalLimit : null,
      bankDetails: bankDetails || {},
      panNumber,
      address,
      isActive: true,
      otpEnabled: true,
      createdBy: req.user._id,
      managerId: assignedManagerId ?? null,
      employeeNumber: employeeNumber || undefined,
    });

    // Log user creation activity
    await logUserActivity("created", user, req.user, {
      newData: { name, email, role, department },
      changes: ["User account created"],
    });

    // Send invitation email with OTP setup instructions
    let emailSent = false;
    let emailError = null;
    try {
      const emailResult = await sendUserInvitation(user);
      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailError = emailResult.error;
        console.error("Failed to send invitation email:", emailResult.error);
      }
    } catch (err) {
      console.error("Failed to send invitation email:", err);
      emailError = err.message;
      // Don't fail user creation if email fails
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? "User created successfully. Invitation email sent to " + user.email
        : "User created successfully. However, invitation email could not be sent. Please check email configuration.",
      emailSent,
      emailError,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Deactivate user
// @route   PATCH /api/users/:id/deactivate
// @access  Private (Admin)
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const wasActive = user.isActive;
    user.isActive = false;
    await user.save();

    // Log deactivation
    if (wasActive) {
      await logUserActivity("deactivated", user, req.user, {
        previousData: { isActive: true },
        newData: { isActive: false },
        changes: ["User account deactivated"],
      });
    }

    res.status(200).json({
      success: true,
      message:
        "User deactivated successfully. Historical data remains accessible.",
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Resend invitation email to user
// @route   POST /api/users/:id/resend-invitation
// @access  Private (Admin)
exports.resendInvitation = async (req, res) => {
  try {
    console.log("=== RESEND INVITATION START ===");
    console.log("User ID:", req.params.id);

    const user = await User.findById(req.params.id);
    console.log("User found:", user ? user.email : "NOT FOUND");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: "Cannot send invitation to deactivated user",
      });
    }

    console.log("Calling sendUserInvitation for:", user.email);

    // Send invitation email (no password needed for OTP-based auth)
    const emailResult = await sendUserInvitation(user, null);

    console.log("Email result:", emailResult);

    if (emailResult.success) {
      console.log("✅ Email sent successfully");
      res.status(200).json({
        success: true,
        message: "Invitation email sent successfully to " + user.email,
      });
    } else {
      console.error("❌ Email send failed:", emailResult.error);
      res.status(500).json({
        success: false,
        message:
          "Failed to send invitation email: " +
          (emailResult.error || "Unknown error"),
      });
    }
  } catch (error) {
    console.error("❌ Resend invitation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
