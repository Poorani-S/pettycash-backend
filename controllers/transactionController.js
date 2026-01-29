const Transaction = require("../models/Transaction");
const Category = require("../models/Category");
const Budget = require("../models/Budget");
const Balance = require("../models/Balance");
const User = require("../models/User");
const { createAuditLog } = require("../middleware/auditMiddleware");
const { deleteFile, formatFileUrl } = require("../utils/fileUtils");

// Notification service - load only if available
let notificationService;
try {
  notificationService = require("../services/notificationService");
} catch (error) {
  console.warn("Notification service not available:", error.message);
  notificationService = {
    notifyExpenseSubmitted: async () => ({ success: false }),
    notifyExpenseStatusUpdate: async () => ({ success: false }),
    notifyAdditionalInfoRequested: async () => ({ success: false }),
  };
}

const {
  notifyExpenseSubmitted,
  notifyExpenseStatusUpdate,
  notifyAdditionalInfoRequested,
} = notificationService;

// Report service - load only if available
let reportService;
try {
  reportService = require("../services/reportService");
} catch (error) {
  console.warn("Report service not available:", error.message);
  reportService = {
    sendAdminReportToCEO: async () => ({ success: false }),
  };
}

// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const { status, category, startDate, endDate, search } = req.query;

    // Build query
    let query = {};

    // Role-based filtering - Follow hierarchy
    if (
      req.user.role === "employee" ||
      req.user.role === "intern" ||
      req.user.role === "handler"
    ) {
      // Employees, interns, and handlers can only see their own transactions
      query.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      // Managers can see:
      // 1. Their own transactions
      // 2. Transactions submitted by their team members (employees/interns under them)
      const teamMembers = await User.find({ managerId: req.user._id }, "_id");
      const teamMemberIds = teamMembers.map((member) => member._id);

      query.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ];
    }
    // Admin, custodian, and auditor can see all transactions

    if (status) query.status = status;
    if (category) query.category = category;

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) query.transactionDate.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { transactionNumber: { $regex: search, $options: "i" } },
        { purpose: { $regex: search, $options: "i" } },
        { payeeClientName: { $regex: search, $options: "i" } },
      ];
    }

    const transactions = await Transaction.find(query)
      .populate("category", "name code")
      .populate("submittedBy", "name email role")
      .populate("requestedBy", "name email role")
      .populate("approvedBy", "name email role")
      .populate("rejectedBy", "name email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single transaction
// @route   GET /api/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("category", "name code description")
      .populate("submittedBy", "name email role phone")
      .populate("requestedBy", "name email role phone")
      .populate("approvedBy", "name email role")
      .populate("rejectedBy", "name email role");

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    // Check access rights - employees and interns can only view their own transactions
    if (
      req.user.role === "employee" ||
      req.user.role === "intern" ||
      req.user.role === "handler"
    ) {
      const isOwner =
        transaction.submittedBy?._id.toString() === req.user._id.toString() ||
        transaction.requestedBy?._id.toString() === req.user._id.toString();

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view this transaction",
        });
      }
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      // Managers can view their own transactions and their team members' transactions
      const isOwner =
        transaction.submittedBy?._id.toString() === req.user._id.toString() ||
        transaction.requestedBy?._id.toString() === req.user._id.toString();

      if (!isOwner) {
        // Check if transaction belongs to a team member
        const teamMembers = await User.find({ managerId: req.user._id }, "_id");
        const teamMemberIds = teamMembers.map((member) =>
          member._id.toString(),
        );

        const isTeamTransaction =
          teamMemberIds.includes(transaction.submittedBy?._id.toString()) ||
          teamMemberIds.includes(transaction.requestedBy?._id.toString());

        if (!isTeamTransaction) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to view this transaction",
          });
        }
      }
    }
    // Admin, custodian, and auditor can view all transactions

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create new transaction
// @route   POST /api/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    const {
      title,
      description,
      amount,
      category,
      transactionDate,
      paymentMethod,
      vendor,
      receiptNumber,
      notes,
      hasGSTInvoice,
      invoiceDate,
      payeeClientName,
      purpose,
      preTaxAmount,
      taxAmount,
      postTaxAmount,
      paymentDate,
      paymentMode,
    } = req.body;

    // Check if category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    // Generate unique transaction number (format: TXN-YYYYMMDD-XXXX)
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await Transaction.countDocuments({
      createdAt: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999)),
      },
    });
    const transactionNumber = `TXN-${dateStr}-${String(count + 1).padStart(4, "0")}`;

    // Handle file uploads
    const invoiceImage = req.files?.invoiceImage
      ? formatFileUrl(req.files.invoiceImage[0].path)
      : undefined;
    const paymentProofImage = req.files?.paymentProofImage
      ? formatFileUrl(req.files.paymentProofImage[0].path)
      : undefined;

    // Create transaction with proper field mapping
    const transaction = await Transaction.create({
      transactionNumber,
      title: purpose || title,
      description: purpose || description,
      amount: postTaxAmount || amount,
      category,
      transactionDate: transactionDate || Date.now(),
      paymentMethod: paymentMode || paymentMethod,
      vendor: payeeClientName || vendor,
      receiptNumber,
      notes,
      submittedBy: req.user._id,
      requestedBy: req.user._id,
      status: "pending",
      hasGSTInvoice: hasGSTInvoice || false,
      invoiceDate,
      payeeClientName,
      purpose,
      preTaxAmount,
      taxAmount: taxAmount || 0,
      postTaxAmount,
      paymentDate,
      invoiceImage,
      paymentProofImage,
    });

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("category", "name code")
      .populate("submittedBy", "name email role managerId")
      .populate("requestedBy", "name email role managerId");

    // Implement hierarchical approval workflow
    try {
      const submitter = await User.findById(req.user._id).populate(
        "managerId",
        "name email role",
      );

      // Determine who needs to approve based on hierarchy
      let approvers = [];

      if (
        (req.user.role === "employee" || req.user.role === "intern") &&
        submitter.managerId
      ) {
        // Employee/Intern submits to their manager first (Level 1)
        approvers.push({
          user: submitter.managerId,
          level: 1,
          role: "manager",
        });

        // Then manager's approval goes to admin (Level 2)
        const admins = await User.find({ role: "admin", isActive: true });
        admins.forEach((admin) => {
          approvers.push({
            user: admin,
            level: 2,
            role: "admin",
          });
        });
      } else if (req.user.role === "manager") {
        // Manager submits directly to admin (Level 1 for them)
        const admins = await User.find({ role: "admin", isActive: true });
        admins.forEach((admin) => {
          approvers.push({
            user: admin,
            level: 1,
            role: "admin",
          });
        });
      } else {
        // For other roles (custodian, auditor), use legacy approval flow
        const legacyApprovers = await User.find({
          role: { $in: ["approver", "admin"] },
          isActive: true,
        });
        approvers = legacyApprovers.map((user) => ({
          user: user,
          level: user.role === "admin" ? 2 : 1,
          role: user.role,
        }));
      }

      // Send notifications to level 1 approvers only (manager or admin depending on submitter)
      const level1Approvers = approvers.filter((a) => a.level === 1);
      if (level1Approvers.length > 0) {
        await notifyExpenseSubmitted(
          populatedTransaction,
          req.user,
          level1Approvers.map((a) => a.user),
        );
      }
    } catch (notifError) {
      console.error("Notification error:", notifError);
      // Don't fail the transaction if notification fails
    }

    res.status(201).json({
      success: true,
      data: populatedTransaction,
      message: "Transaction submitted successfully",
    });
  } catch (error) {
    // Clean up uploaded files if transaction creation fails
    if (req.files?.invoiceImage) {
      await deleteFile(req.files.invoiceImage[0].path);
    }
    if (req.files?.paymentProofImage) {
      await deleteFile(req.files.paymentProofImage[0].path);
    }
    console.error("Transaction creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update transaction
// @route   PUT /api/transactions/:id
// @access  Private
exports.updateTransaction = async (req, res) => {
  try {
    let transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    // Check ownership - only owner or admin can update
    const isOwner =
      transaction.submittedBy?.toString() === req.user._id.toString() ||
      transaction.requestedBy?.toString() === req.user._id.toString();

    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this transaction",
      });
    }

    // Can only update if in draft or pending status
    if (!["draft", "pending"].includes(transaction.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot update transaction after approval/rejection",
      });
    }

    const {
      title,
      description,
      amount,
      category,
      transactionDate,
      paymentMethod,
      vendor,
      receiptNumber,
      notes,
      purpose,
      preTaxAmount,
      taxAmount,
      postTaxAmount,
      hasGSTInvoice,
      invoiceDate,
      payeeClientName,
      paymentDate,
      paymentMode,
    } = req.body;

    // Handle file uploads if any
    const updateData = {
      title: purpose || title,
      description: purpose || description,
      amount: postTaxAmount || amount,
      category,
      transactionDate,
      paymentMethod: paymentMode || paymentMethod,
      vendor: payeeClientName || vendor,
      receiptNumber,
      notes,
      purpose,
      preTaxAmount,
      taxAmount,
      postTaxAmount,
      hasGSTInvoice,
      invoiceDate,
      payeeClientName,
      paymentDate,
    };

    if (req.files?.invoiceImage) {
      updateData.invoiceImage = formatFileUrl(req.files.invoiceImage[0].path);
    }
    if (req.files?.paymentProofImage) {
      updateData.paymentProofImage = formatFileUrl(
        req.files.paymentProofImage[0].path,
      );
    }

    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    )
      .populate("category", "name code")
      .populate("submittedBy", "name email")
      .populate("requestedBy", "name email");

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete transaction
// @route   DELETE /api/transactions/:id
// @access  Private
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    // Only owner or admin can delete if in draft
    if (
      transaction.requestedBy.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this transaction",
      });
    }

    if (transaction.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete transaction after submission",
      });
    }

    await transaction.deleteOne();

    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit transaction for approval
// @route   POST /api/transactions/:id/submit
// @access  Private
exports.submitTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (transaction.requestedBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    if (transaction.status !== "draft") {
      return res
        .status(400)
        .json({ success: false, message: "Transaction already submitted" });
    }

    // Update status and add manager approval
    transaction.status = "pending_manager";
    transaction.approvals = [
      {
        approver: req.user.managerId,
        role: "manager",
        status: "pending",
      },
    ];

    await transaction.save();

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("category", "name code")
      .populate("requestedBy", "name email")
      .populate("approvals.approver", "name email role");

    createAuditLog(
      "CREATE_TRANSACTION",
      req.user._id,
      "Transaction",
      transaction._id,
      {},
      req,
    );

    res.status(200).json({
      success: true,
      data: populatedTransaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve transaction
// @route   POST /api/transactions/:id/approve
// @access  Private (Manager, Finance)
exports.approveTransaction = async (req, res) => {
  try {
    const { comments } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    // Check if user can approve
    if (!["manager", "finance", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to approve transactions",
      });
    }

    // Manager approval
    if (
      req.user.role === "manager" &&
      transaction.status === "pending_manager"
    ) {
      const approvalIndex = transaction.approvals.findIndex(
        (a) => a.role === "manager" && a.status === "pending",
      );

      if (approvalIndex !== -1) {
        transaction.approvals[approvalIndex].approver = req.user._id;
        transaction.approvals[approvalIndex].status = "approved";
        transaction.approvals[approvalIndex].comments = comments;
        transaction.approvals[approvalIndex].actionDate = Date.now();

        // Move to finance approval
        transaction.status = "pending_finance";
        transaction.approvals.push({
          role: "finance",
          status: "pending",
        });
      }
    }

    // Finance approval
    if (
      req.user.role === "finance" &&
      transaction.status === "pending_finance"
    ) {
      const approvalIndex = transaction.approvals.findIndex(
        (a) => a.role === "finance" && a.status === "pending",
      );

      if (approvalIndex !== -1) {
        transaction.approvals[approvalIndex].approver = req.user._id;
        transaction.approvals[approvalIndex].status = "approved";
        transaction.approvals[approvalIndex].comments = comments;
        transaction.approvals[approvalIndex].actionDate = Date.now();

        transaction.status = "approved";
      }
    }

    await transaction.save();

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("category", "name code")
      .populate("requestedBy", "name email")
      .populate("approvals.approver", "name email role");

    createAuditLog(
      "APPROVE_TRANSACTION",
      req.user._id,
      "Transaction",
      transaction._id,
      { comments },
      req,
    );

    res.status(200).json({
      success: true,
      data: populatedTransaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject transaction
// @route   POST /api/transactions/:id/reject
// @access  Private (Manager, Finance)
exports.rejectTransaction = async (req, res) => {
  try {
    const { comments } = req.body;

    if (!comments) {
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });
    }

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (!["manager", "finance", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to reject transactions",
      });
    }

    // Update approval status
    const approvalIndex = transaction.approvals.findIndex(
      (a) => a.status === "pending" && a.role === req.user.role,
    );

    if (approvalIndex !== -1) {
      transaction.approvals[approvalIndex].approver = req.user._id;
      transaction.approvals[approvalIndex].status = "rejected";
      transaction.approvals[approvalIndex].comments = comments;
      transaction.approvals[approvalIndex].actionDate = Date.now();
    }

    transaction.status = "rejected";
    transaction.rejectionReason = comments;

    await transaction.save();

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("category", "name code")
      .populate("requestedBy", "name email")
      .populate("approvals.approver", "name email role");

    createAuditLog(
      "REJECT_TRANSACTION",
      req.user._id,
      "Transaction",
      transaction._id,
      { comments },
      req,
    );

    res.status(200).json({
      success: true,
      data: populatedTransaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark transaction as paid
// @route   POST /api/transactions/:id/pay
// @access  Private (Finance, Admin)
exports.markAsPaid = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (transaction.status !== "approved") {
      return res.status(400).json({
        success: false,
        message: "Only approved transactions can be marked as paid",
      });
    }

    transaction.status = "paid";
    transaction.paidDate = Date.now();

    await transaction.save();

    // Update budget spent amount
    const date = new Date(transaction.transactionDate);
    await Budget.findOneAndUpdate(
      {
        category: transaction.category,
        "period.month": date.getMonth() + 1,
        "period.year": date.getFullYear(),
      },
      { $inc: { spentAmount: transaction.amount } },
    );

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate("category", "name code")
      .populate("requestedBy", "name email")
      .populate("approvals.approver", "name email role");

    res.status(200).json({
      success: true,
      data: populatedTransaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Simple approve transaction (Admin only)
// @route   PATCH /api/transactions/:id/approve
// @access  Private (Admin)
exports.simpleApproveTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("submittedBy", "_id name email role managerId")
      .populate("requestedBy", "_id name email role managerId");

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Transaction cannot be approved. Current status: ${transaction.status}. Only pending transactions can be approved.`,
      });
    }

    // For managers, verify the transaction belongs to their team member
    if (req.user.role === "manager") {
      const submittedByManagerId =
        transaction.submittedBy?.managerId?.toString();
      const requestedByManagerId =
        transaction.requestedBy?.managerId?.toString();
      const currentUserId = req.user._id.toString();

      const isOwnTransaction =
        transaction.submittedBy?._id.toString() === currentUserId ||
        transaction.requestedBy?._id.toString() === currentUserId;

      const isTeamTransaction =
        submittedByManagerId === currentUserId ||
        requestedByManagerId === currentUserId;

      console.log("Manager approval check:", {
        managerId: currentUserId,
        submittedBy: transaction.submittedBy?.name,
        submittedByManagerId,
        requestedBy: transaction.requestedBy?.name,
        requestedByManagerId,
        isOwnTransaction,
        isTeamTransaction,
      });

      if (!isOwnTransaction && !isTeamTransaction) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to approve this transaction. You can only approve transactions from your team members or your own transactions.",
        });
      }
    }

    // Update balance - deduct the expense
    let balance = await Balance.findOne();

    // Create default balance if it doesn't exist
    if (!balance) {
      balance = await Balance.create({
        accountType: "petty_cash_bank",
        currentBalance: 1000000, // Default 10 lakh initial balance
        totalReceived: 1000000,
        totalSpent: 0,
        updatedBy: req.user._id,
      });
      console.log("Created default balance:", balance);
    }

    if (balance.currentBalance < transaction.postTaxAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance to approve this transaction. Current balance: ₹${balance.currentBalance.toLocaleString("en-IN")}, Required: ₹${transaction.postTaxAmount.toLocaleString("en-IN")}`,
      });
    }

    balance.currentBalance -= transaction.postTaxAmount;
    balance.totalSpent = (balance.totalSpent || 0) + transaction.postTaxAmount;
    balance.lastUpdated = new Date();
    balance.updatedBy = req.user._id;
    await balance.save();

    // Update transaction status
    transaction.status = "approved";
    transaction.approvedBy = req.user._id;
    transaction.approvedAt = new Date();
    await transaction.save();

    await transaction.populate("category submittedBy approvedBy");

    // Send notification to custodian
    try {
      await notifyExpenseStatusUpdate(
        transaction,
        transaction.submittedBy,
        req.user,
        "approved",
        req.body.comment || "Approved",
      );
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }

    // Send admin report to CEO if action was performed by admin
    if (req.user.role === "admin") {
      try {
        await reportService.sendAdminReportToCEO(req.user._id);
        console.log("Admin report sent to CEO after approval");
      } catch (reportError) {
        console.error("Report error:", reportError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Transaction approved successfully",
      data: transaction,
      newBalance: balance.currentBalance,
    });
  } catch (error) {
    console.error("Transaction approval error:", error);
    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to approve transaction. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Simple reject transaction (Admin only)
// @route   PATCH /api/transactions/:id/reject
// @access  Private (Admin)
exports.simpleRejectTransaction = async (req, res) => {
  try {
    const { comment } = req.body;
    const transaction = await Transaction.findById(req.params.id)
      .populate("submittedBy", "_id name email role managerId")
      .populate("requestedBy", "_id name email role managerId");

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (transaction.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Transaction cannot be rejected. Current status: ${transaction.status}. Only pending transactions can be rejected.`,
      });
    }

    if (!comment || comment.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Rejection reason/comment is required",
      });
    }

    // For managers, verify the transaction belongs to their team member
    if (req.user.role === "manager") {
      const submittedByManagerId =
        transaction.submittedBy?.managerId?.toString();
      const requestedByManagerId =
        transaction.requestedBy?.managerId?.toString();
      const currentUserId = req.user._id.toString();

      const isOwnTransaction =
        transaction.submittedBy?._id.toString() === currentUserId ||
        transaction.requestedBy?._id.toString() === currentUserId;

      const isTeamTransaction =
        submittedByManagerId === currentUserId ||
        requestedByManagerId === currentUserId;

      console.log("Manager rejection check:", {
        managerId: currentUserId,
        submittedBy: transaction.submittedBy?.name,
        submittedByManagerId,
        requestedBy: transaction.requestedBy?.name,
        requestedByManagerId,
        isOwnTransaction,
        isTeamTransaction,
      });

      if (!isOwnTransaction && !isTeamTransaction) {
        return res.status(403).json({
          success: false,
          message:
            "Not authorized to reject this transaction. You can only reject transactions from your team members or your own transactions.",
        });
      }
    }

    transaction.status = "rejected";
    transaction.rejectedBy = req.user._id;
    transaction.rejectedAt = new Date();
    transaction.adminComment = comment || "Rejected";
    await transaction.save();

    await transaction.populate("category submittedBy rejectedBy");

    // Send notification to custodian
    try {
      await notifyExpenseStatusUpdate(
        transaction,
        transaction.submittedBy,
        req.user,
        "rejected",
        comment || "Rejected by admin",
      );
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }

    // Send admin report to CEO if action was performed by admin
    if (req.user.role === "admin") {
      try {
        await reportService.sendAdminReportToCEO(req.user._id);
        console.log("Admin report sent to CEO after rejection");
      } catch (reportError) {
        console.error("Report error:", reportError);
      }
    }

    res.status(200).json({
      success: true,
      message: "Transaction rejected successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Transaction rejection error:", error);
    res.status(500).json({
      success: false,
      message:
        error.message || "Failed to reject transaction. Please try again.",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// @desc    Request additional information for transaction
// @route   POST /api/transactions/:id/request-info
// @access  Private (Approver, Admin)
exports.requestAdditionalInfo = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please specify what additional information is required",
      });
    }

    const transaction = await Transaction.findById(req.params.id)
      .populate("submittedBy", "name email")
      .populate("category", "name code");

    if (!transaction) {
      return res
        .status(404)
        .json({ success: false, message: "Transaction not found" });
    }

    if (!["pending", "pending_approval"].includes(transaction.status)) {
      return res.status(400).json({
        success: false,
        message: "Can only request information for pending transactions",
      });
    }

    // Check if user is authorized (approver or admin)
    if (!["approver", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to request additional information",
      });
    }

    // Add info request to transaction notes
    const infoRequest = {
      requestedBy: req.user.name,
      requestedAt: new Date(),
      message: message.trim(),
    };

    transaction.status = "info_requested";
    transaction.notes = transaction.notes
      ? `${transaction.notes}\\n\\n[INFO REQUESTED by ${req.user.name} on ${new Date().toLocaleString()}]: ${message}`
      : `[INFO REQUESTED by ${req.user.name} on ${new Date().toLocaleString()}]: ${message}`;

    await transaction.save();

    // Send notification to custodian
    try {
      await notifyAdditionalInfoRequested(
        transaction,
        transaction.submittedBy,
        req.user,
        message,
      );
    } catch (notifError) {
      console.error("Notification error:", notifError);
    }

    // Create audit log
    createAuditLog(
      "REQUEST_INFO",
      req.user._id,
      "Transaction",
      transaction._id,
      { message },
      req,
    );

    res.status(200).json({
      success: true,
      message: "Information request sent to custodian",
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send admin transaction report to CEO
// @route   POST /api/transactions/send-ceo-report
// @access  Private (Admin only)
exports.sendCEOReport = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can send CEO reports",
      });
    }

    const result = await reportService.sendAdminReportToCEO(req.user._id);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        transactionCount: result.transactionCount,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || result.error,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
