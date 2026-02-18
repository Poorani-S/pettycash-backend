const FundTransfer = require("../models/FundTransfer");
const Balance = require("../models/Balance");
const User = require("../models/User");
const Client = require("../models/Client");

// @desc    Add funds to petty cash (Bank Transfer or Cash)
// @route   POST /api/fund-transfers
// @access  Admin only
exports.addFunds = async (req, res) => {
  try {
    const {
      transferType,
      amount,
      bankName,
      accountNumber,
      transactionId,
      remarks,
      transferDate,
      purpose,
      clientId,
      preserveTimestamp, // For expense-to-fund-transfer conversion
    } = req.body;

    // Validation
    if (!transferType || !amount || !transferDate) {
      return res.status(400).json({
        success: false,
        message: "Transfer type, amount, and date are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // Validate transfer type specific fields
    if (transferType === "bank") {
      if (!bankName || !accountNumber || !transactionId) {
        return res.status(400).json({
          success: false,
          message:
            "Bank name, account number, and transaction ID are required for bank transfers",
        });
      }
    }

    // Generate unique transfer ID
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const count = await FundTransfer.countDocuments();
    const transferId = `FT${year}${month}${String(count + 1).padStart(4, "0")}`;

    // Create fund transfer record
    const fundTransferData = {
      transferId,
      transferType,
      amount,
      bankName: transferType === "bank" ? bankName : undefined,
      fromAccount: transferType === "bank" ? accountNumber : undefined,
      transactionReference: transferType === "bank" ? transactionId : undefined,
      notes: remarks,
      transferDate,
      initiatedBy: req.user._id,
      purpose: purpose || undefined,
      recipientId: clientId || undefined,
    };

    // If converting from expense, preserve original timestamp
    if (preserveTimestamp) {
      fundTransferData.createdAt = new Date(preserveTimestamp);
    }

    const fundTransfer = await FundTransfer.create(fundTransferData);

    // Populate recipientId for response
    await fundTransfer.populate("recipientId", "name email phone bankDetails");

    // Update balance
    let balance = await Balance.findOne();
    if (!balance) {
      // Create initial balance if doesn't exist
      balance = await Balance.create({
        accountType: "petty_cash_bank",
        currentBalance: amount,
        totalReceived: amount,
        totalSpent: 0,
        lastUpdated: new Date(),
        updatedBy: req.user._id,
      });
    } else {
      balance.currentBalance += amount;
      balance.totalReceived += amount;
      balance.lastUpdated = new Date();
      balance.updatedBy = req.user._id;
      await balance.save();
    }

    // Populate the initiatedBy field with user details
    await fundTransfer.populate("initiatedBy", "name email");

    res.status(201).json({
      success: true,
      message: "Funds added successfully",
      data: fundTransfer,
      balance: balance.currentBalance,
    });
  } catch (error) {
    console.error("Error adding funds:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add funds",
      error: error.message,
    });
  }
};

// @desc    Get all fund transfers with filters
// @route   GET /api/fund-transfers
// @access  Admin only
exports.getFundTransfers = async (req, res) => {
  try {
    const {
      transferType,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = "-transferDate",
    } = req.query;

    // Build query
    const query = {};

    if (transferType) {
      query.transferType = transferType;
    }

    if (startDate || endDate) {
      query.transferDate = {};
      if (startDate) {
        query.transferDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.transferDate.$lte = new Date(endDate);
      }
    }

    // Execute query with pagination
    const fundTransfers = await FundTransfer.find(query)
      .populate("initiatedBy", "name email role")
      .populate("recipientId", "name email phone bankDetails")
      .sort(sortBy)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await FundTransfer.countDocuments(query);

    res.status(200).json({
      success: true,
      data: fundTransfers,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      totalRecords: count,
    });
  } catch (error) {
    console.error("Error fetching fund transfers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fund transfers",
      error: error.message,
    });
  }
};

// @desc    Get fund transfer by ID
// @route   GET /api/fund-transfers/:id
// @access  Admin only
exports.getFundTransferById = async (req, res) => {
  try {
    const fundTransfer = await FundTransfer.findById(req.params.id)
      .populate("initiatedBy", "name email role")
      .populate("recipientId", "name email phone bankDetails");

    if (!fundTransfer) {
      return res.status(404).json({
        success: false,
        message: "Fund transfer not found",
      });
    }

    res.status(200).json({
      success: true,
      data: fundTransfer,
    });
  } catch (error) {
    console.error("Error fetching fund transfer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch fund transfer",
      error: error.message,
    });
  }
};

// @desc    Get current balance
// @route   GET /api/fund-transfers/balance/current
// @access  Authenticated users
exports.getCurrentBalance = async (req, res) => {
  try {
    let balance = await Balance.findOne().populate("updatedBy", "name email");

    if (!balance) {
      // Initialize balance if doesn't exist
      balance = await Balance.create({
        accountType: "petty_cash_bank",
        currentBalance: 0,
        totalReceived: 0,
        totalSpent: 0,
        lastUpdated: new Date(),
        updatedBy: req.user._id,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        currentBalance: balance.currentBalance,
        lastUpdated: balance.lastUpdated,
        updatedBy: balance.updatedBy,
      },
    });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch balance",
      error: error.message,
    });
  }
};

// @desc    Get fund transfer statistics
// @route   GET /api/fund-transfers/stats/summary
// @access  Admin only
exports.getFundTransferStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.transferDate = {};
      if (startDate) matchStage.transferDate.$gte = new Date(startDate);
      if (endDate) matchStage.transferDate.$lte = new Date(endDate);
    }

    const stats = await FundTransfer.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$transferType",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
          avgAmount: { $avg: "$amount" },
        },
      },
    ]);

    const totalFunds = await FundTransfer.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        byType: stats,
        overall: totalFunds[0] || { total: 0, count: 0 },
      },
    });
  } catch (error) {
    console.error("Error fetching fund transfer stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// @desc    Delete fund transfer (Admin only - use with caution)
// @route   DELETE /api/fund-transfers/:id
// @access  Admin only
exports.deleteFundTransfer = async (req, res) => {
  try {
    const fundTransfer = await FundTransfer.findById(req.params.id);

    if (!fundTransfer) {
      return res.status(404).json({
        success: false,
        message: "Fund transfer not found",
      });
    }

    // Reverse the balance
    const balance = await Balance.findOne();
    if (balance) {
      balance.currentBalance -= fundTransfer.amount;
      balance.lastUpdated = new Date();
      balance.lastUpdatedBy = req.user._id;
      await balance.save();
    }

    await fundTransfer.deleteOne();

    res.status(200).json({
      success: true,
      message: "Fund transfer deleted and balance adjusted",
      balance: balance ? balance.currentBalance : 0,
    });
  } catch (error) {
    console.error("Error deleting fund transfer:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete fund transfer",
      error: error.message,
    });
  }
};

// @desc    Clear all fund transfer history
// @route   DELETE /api/fund-transfers/clear-history
// @access  Admin only
exports.clearFundTransferHistory = async (req, res) => {
  try {
    // Delete all fund transfers
    const result = await FundTransfer.deleteMany({});

    res.status(200).json({
      success: true,
      message: `Cleared ${result.deletedCount} fund transfer record(s)`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error clearing fund transfer history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear fund transfer history",
      error: error.message,
    });
  }
};
