const Transaction = require("../models/Transaction");
const FundTransfer = require("../models/FundTransfer");
const Balance = require("../models/Balance");
const Category = require("../models/Category");
const User = require("../models/User");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");
const {
  addPDFHeader,
  addPageHeader,
  addPDFFooter,
  LOGO_PATH,
} = require("../utils/pdfHeader");

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case "all":
      // Return null to indicate no date filtering
      return null;

    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      break;

    case "week":
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      startDate = weekStart;
      endDate = new Date();
      break;

    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;

    case "quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
      break;

    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;

    default:
      // For unknown periods, return null (no date filter)
      return null;
  }

  return { startDate, endDate };
};

const buildTransactionRoleMatch = async (user) => {
  if (!user) return {};

  if (user.role === "employee" || user.role === "intern") {
    return {
      $or: [{ submittedBy: user._id }, { requestedBy: user._id }],
    };
  }

  if (user.role === "manager" || user.role === "approver") {
    const teamMembers = await User.find({ managerId: user._id }, "_id");
    const teamMemberIds = teamMembers.map((member) => member._id);
    return {
      $or: [
        { submittedBy: user._id },
        { requestedBy: user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ],
    };
  }

  // Admin, employee, and auditor can see all transactions
  return {};
};

// @desc    Get unified financial summary (Fund Transfers + Expense Transactions)
// @route   GET /api/reports/financial-summary
// @access  Private
exports.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;

    // Date filters
    let fundTransferMatch = {};
    let transactionMatch = {};

    if (startDate && endDate) {
      fundTransferMatch.transferDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      transactionMatch.transactionDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (period && period !== "all") {
      const range = getDateRange(period);
      if (range) {
        fundTransferMatch.transferDate = {
          $gte: range.startDate,
          $lte: range.endDate,
        };
        transactionMatch.transactionDate = {
          $gte: range.startDate,
          $lte: range.endDate,
        };
      }
    }

    // Fund transfers summary
    // NOTE: fund transfer access is restricted elsewhere to admin/manager.
    // Keep this endpoint usable for all roles, but only return fund transfer aggregates to admin/manager.
    const canSeeFundTransfers =
      req.user?.role === "admin" || req.user?.role === "manager";

    let byTypeArr = [];
    let overallObj = { total: 0, count: 0 };

    if (canSeeFundTransfers) {
      const fundTransferAgg = await FundTransfer.aggregate([
        { $match: fundTransferMatch },
        {
          $facet: {
            byType: [
              {
                $group: {
                  _id: "$transferType",
                  totalAmount: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { totalAmount: -1 } },
            ],
            overall: [
              {
                $group: {
                  _id: null,
                  total: { $sum: "$amount" },
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]);

      byTypeArr = fundTransferAgg?.[0]?.byType || [];
      overallObj = fundTransferAgg?.[0]?.overall?.[0] || { total: 0, count: 0 };
    }

    const fundByType = byTypeArr.reduce((acc, row) => {
      acc[row._id] = {
        totalAmount: row.totalAmount || 0,
        count: row.count || 0,
      };
      return acc;
    }, {});

    // Expense transactions summary (role-filtered)
    const roleMatch = await buildTransactionRoleMatch(req.user);
    const expenseMatch = { ...transactionMatch, ...roleMatch };

    const expenseByStatus = await Transaction.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$postTaxAmount", 0] } },
        },
      },
    ]);

    const pendingStatuses = ["pending", "pending_approval", "info_requested"];
    const approvedStatuses = ["approved", "paid"];
    const rejectedStatuses = ["rejected"];

    const expenseStatusMap = expenseByStatus.reduce((acc, row) => {
      acc[row._id] = {
        count: row.count || 0,
        totalAmount: row.totalAmount || 0,
      };
      return acc;
    }, {});

    const sumGroups = (statuses) =>
      statuses.reduce(
        (acc, status) => {
          acc.count += expenseStatusMap[status]?.count || 0;
          acc.totalAmount += expenseStatusMap[status]?.totalAmount || 0;
          return acc;
        },
        { count: 0, totalAmount: 0 },
      );

    const pending = sumGroups(pendingStatuses);
    const approved = sumGroups(approvedStatuses);
    const rejected = sumGroups(rejectedStatuses);
    const totalTransactions = Object.values(expenseStatusMap).reduce(
      (sum, s) => sum + (s.count || 0),
      0,
    );
    const totalAmount = Object.values(expenseStatusMap).reduce(
      (sum, s) => sum + (s.totalAmount || 0),
      0,
    );

    res.status(200).json({
      success: true,
      data: {
        dateRange: {
          start:
            expenseMatch.transactionDate?.$gte ||
            fundTransferMatch.transferDate?.$gte ||
            null,
          end:
            expenseMatch.transactionDate?.$lte ||
            fundTransferMatch.transferDate?.$lte ||
            null,
        },
        fundTransfers: {
          overall: {
            total: overallObj.total || 0,
            count: overallObj.count || 0,
          },
          byType: fundByType,
          rawByType: byTypeArr,
        },
        expenseTransactions: {
          byStatus: expenseStatusMap,
          summary: {
            totalTransactions,
            totalAmount,
            approvedCount: approved.count,
            approvedAmount: approved.totalAmount,
            pendingCount: pending.count,
            pendingAmount: pending.totalAmount,
            rejectedCount: rejected.count,
            rejectedAmount: rejected.totalAmount,
          },
        },
      },
    });
  } catch (error) {
    console.error("Financial summary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get transaction summary report
// @route   GET /api/reports/summary
// @access  Private
exports.getSummaryReport = async (req, res) => {
  try {
    const { startDate, endDate, period, category, status } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        transactionDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else if (period && period !== "all") {
      const range = getDateRange(period);
      if (range) {
        dateFilter = {
          transactionDate: {
            $gte: range.startDate,
            $lte: range.endDate,
          },
        };
      }
      // If range is null (period="all"), dateFilter stays empty - no date filtering
    }

    let matchQuery = { ...dateFilter };
    if (category) matchQuery.category = category;
    if (status) matchQuery.status = status;

    // Role-based filtering - Follow hierarchy (same as transactionController)
    if (req.user.role === "employee" || req.user.role === "intern") {
      // Employees and interns can only see their own transactions
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      // Managers can see their own and their team's transactions
      const teamMembers = await User.find({ managerId: req.user._id }, "_id");
      const teamMemberIds = teamMembers.map((member) => member._id);

      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ];
    }
    // Admin, employee, and auditor can see all transactions

    const transactions = await Transaction.find(matchQuery)
      .populate("category", "name code")
      .populate("submittedBy", "name email")
      .sort({ transactionDate: -1 });

    // Define status groups for accurate counting
    const pendingStatuses = ["pending", "pending_approval", "info_requested"];
    const approvedStatuses = ["approved", "paid"];
    const rejectedStatuses = ["rejected"];

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce(
        (sum, t) => sum + (t.postTaxAmount || t.amount),
        0,
      ),
      approvedCount: transactions.filter((t) =>
        approvedStatuses.includes(t.status),
      ).length,
      approvedAmount: transactions
        .filter((t) => approvedStatuses.includes(t.status))
        .reduce((sum, t) => sum + (t.postTaxAmount || t.amount), 0),
      pendingCount: transactions.filter((t) =>
        pendingStatuses.includes(t.status),
      ).length,
      pendingAmount: transactions
        .filter((t) => pendingStatuses.includes(t.status))
        .reduce((sum, t) => sum + (t.postTaxAmount || t.amount), 0),
      rejectedCount: transactions.filter((t) =>
        rejectedStatuses.includes(t.status),
      ).length,
      rejectedAmount: transactions
        .filter((t) => rejectedStatuses.includes(t.status))
        .reduce((sum, t) => sum + (t.postTaxAmount || t.amount), 0),
    };

    const categoryBreakdown = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$postTaxAmount", "$amount"] } },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          _id: 1,
          name: "$categoryInfo.name",
          code: "$categoryInfo.code",
          count: 1,
          totalAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    const balance = await Balance.findOne().sort({ lastUpdated: -1 });

    res.status(200).json({
      success: true,
      data: {
        summary,
        categoryBreakdown,
        transactions,
        currentBalance: balance?.currentBalance || 0,
        dateRange: {
          start: matchQuery.transactionDate?.$gte || null,
          end: matchQuery.transactionDate?.$lte || null,
        },
      },
    });
  } catch (error) {
    console.error("Summary report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get category-wise report
// @route   GET /api/reports/by-category
// @access  Private
exports.getCategoryReport = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        transactionDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else if (period && period !== "all") {
      const range = getDateRange(period);
      if (range) {
        dateFilter = {
          transactionDate: {
            $gte: range.startDate,
            $lte: range.endDate,
          },
        };
      }
    }

    let matchQuery = { ...dateFilter, status: "approved" };

    // Role-based filtering - Follow hierarchy (same as transactionController)
    if (req.user.role === "employee" || req.user.role === "intern") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      const teamMembers = await User.find({ managerId: req.user._id }, "_id");
      const teamMemberIds = teamMembers.map((member) => member._id);

      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ];
    }
    // Admin, employee, and auditor can see all transactions

    const categoryReport = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$postTaxAmount", "$amount"] } },
          avgAmount: { $avg: { $ifNull: ["$postTaxAmount", "$amount"] } },
          minAmount: { $min: { $ifNull: ["$postTaxAmount", "$amount"] } },
          maxAmount: { $max: { $ifNull: ["$postTaxAmount", "$amount"] } },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          _id: 1,
          name: "$categoryInfo.name",
          code: "$categoryInfo.code",
          description: "$categoryInfo.description",
          count: 1,
          totalAmount: 1,
          avgAmount: { $round: ["$avgAmount", 2] },
          minAmount: 1,
          maxAmount: 1,
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);

    res.status(200).json({
      success: true,
      data: categoryReport,
    });
  } catch (error) {
    console.error("Category report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get monthly trend report
// @route   GET /api/reports/monthly-trend
// @access  Private
exports.getMonthlyTrend = async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    let matchQuery = {
      transactionDate: {
        $gte: new Date(targetYear, 0, 1),
        $lte: new Date(targetYear, 11, 31, 23, 59, 59),
      },
      status: "approved",
    };

    // Role-based filtering - Follow hierarchy (same as transactionController)
    if (req.user.role === "employee" || req.user.role === "intern") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      const teamMembers = await User.find({ managerId: req.user._id }, "_id");
      const teamMemberIds = teamMembers.map((member) => member._id);

      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ];
    }
    // Admin, employee, and auditor can see all transactions

    const monthlyData = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $month: "$transactionDate" },
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$postTaxAmount", "$amount"] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const result = monthNames.map((name, index) => {
      const monthData = monthlyData.find((m) => m._id === index + 1);
      return {
        month: name,
        monthNumber: index + 1,
        count: monthData?.count || 0,
        totalAmount: monthData?.totalAmount || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        year: targetYear,
        months: result,
      },
    });
  } catch (error) {
    console.error("Monthly trend error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Export report to PDF
// @route   GET /api/reports/export/pdf
// @access  Private
exports.exportPDF = async (req, res) => {
  try {
    const { startDate, endDate, period, category, status } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        transactionDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else if (period && period !== "all") {
      const range = getDateRange(period);
      if (range) {
        dateFilter = {
          transactionDate: {
            $gte: range.startDate,
            $lte: range.endDate,
          },
        };
      }
    }

    let matchQuery = { ...dateFilter };
    if (category) matchQuery.category = category;
    if (status) matchQuery.status = status;

    // Role-based filtering - Follow hierarchy (same as transactionController)
    if (req.user.role === "employee" || req.user.role === "intern") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      const teamMembers = await User.find({ managerId: req.user._id }, "_id");
      const teamMemberIds = teamMembers.map((member) => member._id);

      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ];
    }
    // Admin, employee, and auditor can see all transactions

    const transactions = await Transaction.find(matchQuery)
      .populate("category", "name code")
      .populate("submittedBy", "name email")
      .sort({ transactionDate: -1 });

    const isPaidStatus = (status) => {
      const normalized = (status || "").toString().toLowerCase();
      return normalized === "approved" || normalized === "paid";
    };

    const toNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const totalAmount = transactions.reduce(
      (sum, t) => sum + toNumber(t.postTaxAmount ?? t.amount ?? 0),
      0,
    );
    const approvedAmount = transactions
      .filter((t) => isPaidStatus(t.status))
      .reduce((sum, t) => sum + toNumber(t.postTaxAmount ?? t.amount ?? 0), 0);
    const paidCount = transactions.filter((t) => isPaidStatus(t.status)).length;
    const unpaidCount = transactions.filter(
      (t) => !isPaidStatus(t.status),
    ).length;

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=petty-cash-report-${Date.now()}.pdf`,
    );

    doc.pipe(res);

    // Add reusable header with logo
    const contentStartY = addPDFHeader(doc, "PETTY CASH EXPENSE REPORT");

    // Report Info Box
    const infoBoxY = contentStartY + 5;
    const pageWidth = 595.28; // A4 width in points
    const margin = 40;
    const boxWidth = pageWidth - margin * 2;
    const paddingX = 10;
    const paddingY = 8;
    const colGap = 12;
    const leftColWidth = Math.floor((boxWidth - paddingX * 2 - colGap) * 0.62);
    const rightColWidth = boxWidth - paddingX * 2 - colGap - leftColWidth;
    const leftX = margin + paddingX;
    const rightX = leftX + leftColWidth + colGap;
    const lineGap = 4;

    const reportPeriodText = `Report Period: ${startDate ? new Date(startDate).toLocaleDateString("en-IN") : period || "All Time"} - ${endDate ? new Date(endDate).toLocaleDateString("en-IN") : "Present"}`;
    const generatedOnText = `Generated On: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`;
    const totalTransactionsText = `Total Transactions: ${transactions.length}`;
    const totalAmountText = `Total Amount: Rs.${totalAmount.toLocaleString("en-IN")}`;

    doc.fontSize(9).fillColor("#023e8a");
    const leftHeight =
      doc.heightOfString(reportPeriodText, { width: leftColWidth }) +
      lineGap +
      doc.heightOfString(generatedOnText, { width: leftColWidth });
    const rightHeight =
      doc.heightOfString(totalTransactionsText, { width: rightColWidth }) +
      lineGap +
      doc.heightOfString(totalAmountText, { width: rightColWidth });
    const infoBoxHeight = Math.max(leftHeight, rightHeight) + paddingY * 2;

    doc
      .rect(margin, infoBoxY, boxWidth, infoBoxHeight)
      .fillAndStroke("#f0f9ff", "#0077b6");

    // fillAndStroke changes the current fill color; reset it for text
    doc.fontSize(9).fillColor("#023e8a");

    const leftLine1Height = doc.heightOfString(reportPeriodText, {
      width: leftColWidth,
    });
    const rightLine1Height = doc.heightOfString(totalTransactionsText, {
      width: rightColWidth,
    });

    doc.text(reportPeriodText, leftX, infoBoxY + paddingY, {
      width: leftColWidth,
    });
    doc.text(
      generatedOnText,
      leftX,
      infoBoxY + paddingY + leftLine1Height + lineGap,
      {
        width: leftColWidth,
      },
    );
    doc.text(totalTransactionsText, rightX, infoBoxY + paddingY, {
      width: rightColWidth,
    });
    doc.text(
      totalAmountText,
      rightX,
      infoBoxY + paddingY + rightLine1Height + lineGap,
      {
        width: rightColWidth,
      },
    );

    // Summary Section
    const summaryTitleY = infoBoxY + infoBoxHeight + 18;
    const summaryY = summaryTitleY + 16;
    doc
      .fontSize(12)
      .fillColor("#023e8a")
      .text("SUMMARY", margin, summaryTitleY, { underline: true });
    doc
      .fontSize(9)
      .fillColor("#333")
      .text(
        `Paid (Approved): ${paidCount} transactions - Rs.${approvedAmount.toLocaleString("en-IN")}`,
        margin + 10,
        summaryY,
        { width: Math.floor((boxWidth - 20) * 0.62) },
      )
      .text(
        `Pending/Rejected: ${unpaidCount} transactions`,
        margin + 10 + Math.floor((boxWidth - 20) * 0.62) + 12,
        summaryY,
        {
          width: boxWidth - 20 - Math.floor((boxWidth - 20) * 0.62) - 12,
        },
      );

    // Table Header
    const tableTop = summaryY + 35;
    const tableWidth = pageWidth - margin * 2;
    const colWidths = [70, 75, 80, 95, 70, 60, 65];
    const headers = [
      "Date",
      "User",
      "Amount",
      "Reason",
      "Status",
      "Paid",
      "Payment Mode",
    ];

    // Header background
    doc.rect(margin, tableTop - 5, tableWidth, 22).fill("#023e8a");

    let xPos = margin + 5;
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
    doc.fontSize(8);

    transactions.forEach((txn, index) => {
      // Check for page break
      if (yPos > 720) {
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
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(margin, yPos - 3, tableWidth, 18).fill("#f8fafc");
      }

      const isPaid = isPaidStatus(txn.status);
      const paidStatus = isPaid ? "Yes" : "No";
      const paymentMode = txn.paymentMethod
        ? txn.paymentMethod.replace("_", " ").toUpperCase()
        : "N/A";

      const statusText = (txn.status || "pending")
        .toString()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (ch) => ch.toUpperCase());

      const dateText = txn.transactionDate
        ? new Date(txn.transactionDate).toLocaleDateString("en-IN")
        : "N/A";

      const amountValue = toNumber(txn.postTaxAmount ?? txn.amount ?? 0);

      xPos = margin + 5;
      const rowData = [
        dateText,
        (txn.submittedBy?.name || txn.payeeClientName || "N/A").substring(
          0,
          12,
        ),
        `Rs.${amountValue.toLocaleString("en-IN")}`,
        (txn.purpose || "N/A").substring(0, 15),
        statusText,
        paidStatus,
        paymentMode.substring(0, 10),
      ];

      // Status color coding
      rowData.forEach((data, i) => {
        if (i === 4) {
          // Status column
          if (isPaidStatus(txn.status)) {
            doc.fillColor("#059669");
          } else if (
            (txn.status || "").toString().toLowerCase() === "rejected"
          ) {
            doc.fillColor("#dc2626");
          } else {
            doc.fillColor("#d97706");
          }
        } else if (i === 5) {
          // Paid column
          doc.fillColor(isPaid ? "#059669" : "#dc2626");
        } else {
          doc.fillColor("#333");
        }
        doc.text(data, xPos, yPos, {
          width: colWidths[i],
          align: i === 2 ? "right" : "center",
        });
        xPos += colWidths[i];
      });

      yPos += 18;
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
};

// @desc    Export report to Excel
// @route   GET /api/reports/export/excel
// @access  Private
exports.exportExcel = async (req, res) => {
  try {
    const { startDate, endDate, period, category, status } = req.query;

    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        transactionDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    } else if (period && period !== "all") {
      const range = getDateRange(period);
      if (range) {
        dateFilter = {
          transactionDate: {
            $gte: range.startDate,
            $lte: range.endDate,
          },
        };
      }
    }

    let matchQuery = { ...dateFilter };
    if (category) matchQuery.category = category;
    if (status) matchQuery.status = status;

    // Role-based filtering - Follow hierarchy (same as transactionController)
    if (req.user.role === "employee" || req.user.role === "intern") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    } else if (req.user.role === "manager" || req.user.role === "approver") {
      const teamMembers = await User.find({ managerId: req.user._id }, "_id");
      const teamMemberIds = teamMembers.map((member) => member._id);

      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
        { submittedBy: { $in: teamMemberIds } },
        { requestedBy: { $in: teamMemberIds } },
      ];
    }
    // Admin, employee, and auditor can see all transactions

    const transactions = await Transaction.find(matchQuery)
      .populate("category", "name code")
      .populate("submittedBy", "name email")
      .populate("approvedBy", "name email")
      .sort({ transactionDate: -1 });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Kambaa Petty Cash Management System";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Petty Cash Report");

    // Add header with company info
    worksheet.mergeCells("A1:H1");
    worksheet.getCell("A1").value = "KAMBAA INC. - PETTY CASH EXPENSE REPORT";
    worksheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FF023e8a" },
    };
    worksheet.getCell("A1").alignment = { horizontal: "center" };

    worksheet.mergeCells("A2:H2");
    worksheet.getCell("A2").value =
      `Report Period: ${startDate ? new Date(startDate).toLocaleDateString("en-IN") : period || "All Time"} - ${endDate ? new Date(endDate).toLocaleDateString("en-IN") : "Present"} | Generated: ${new Date().toLocaleDateString("en-IN")}`;
    worksheet.getCell("A2").font = { size: 10, color: { argb: "FF666666" } };
    worksheet.getCell("A2").alignment = { horizontal: "center" };

    // Leave a blank row
    worksheet.addRow([]);

    // Define columns starting from row 4
    worksheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Date", key: "date", width: 14 },
      { header: "User", key: "user", width: 20 },
      { header: "Amount (Rs.)", key: "amount", width: 15 },
      { header: "Reason/Purpose", key: "reason", width: 35 },
      { header: "Paid", key: "paid", width: 10 },
      { header: "Status", key: "status", width: 12 },
      { header: "Payment Mode", key: "paymentMode", width: 15 },
    ];

    // Style header row (row 4)
    const headerRow = worksheet.getRow(4);
    headerRow.values = [
      "S.No",
      "Date",
      "User",
      "Amount (Rs.)",
      "Reason/Purpose",
      "Paid",
      "Status",
      "Payment Mode",
    ];
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF023e8a" },
    };
    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    headerRow.height = 25;

    const isPaidStatus = (status) => {
      const normalized = (status || "").toString().toLowerCase();
      return normalized === "approved" || normalized === "paid";
    };

    const toNumber = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : 0;
    };

    const toTitleCase = (value) => {
      const text = (value || "pending").toString().replace(/_/g, " ");
      return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
    };

    // Add transaction data
    transactions.forEach((txn, index) => {
      const isPaid = isPaidStatus(txn.status);
      const dateText = txn.transactionDate
        ? new Date(txn.transactionDate).toLocaleDateString("en-IN")
        : "N/A";
      const row = worksheet.addRow({
        sno: index + 1,
        date: dateText,
        user: txn.submittedBy?.name || txn.payeeClientName || "N/A",
        amount: toNumber(txn.postTaxAmount ?? txn.amount ?? 0),
        reason: txn.purpose || "N/A",
        paid: isPaid ? "Yes" : "No",
        status: toTitleCase(txn.status),
        paymentMode: txn.paymentMethod
          ? txn.paymentMethod.replace(/_/g, " ").toUpperCase()
          : "N/A",
      });

      // Alternate row colors
      if (index % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }

      // Color code the Paid column
      const paidCell = row.getCell(6);
      paidCell.font = {
        bold: true,
        color: { argb: isPaid ? "FF059669" : "FFdc2626" },
      };

      // Color code the Status column
      const statusCell = row.getCell(7);
      if (isPaidStatus(txn.status)) {
        statusCell.font = { color: { argb: "FF059669" } };
      } else if ((txn.status || "").toString().toLowerCase() === "rejected") {
        statusCell.font = { color: { argb: "FFdc2626" } };
      } else {
        statusCell.font = { color: { argb: "FFd97706" } };
      }
    });

    // Add summary section
    const summaryRow = worksheet.rowCount + 2;
    worksheet.mergeCells(`A${summaryRow}:B${summaryRow}`);
    worksheet.getCell(`A${summaryRow}`).value = "SUMMARY";
    worksheet.getCell(`A${summaryRow}`).font = {
      bold: true,
      size: 12,
      color: { argb: "FF023e8a" },
    };

    const totalAmount = transactions.reduce(
      (sum, t) => sum + toNumber(t.postTaxAmount ?? t.amount ?? 0),
      0,
    );
    const paidCount = transactions.filter((t) => isPaidStatus(t.status)).length;
    const unpaidCount = transactions.filter(
      (t) => !isPaidStatus(t.status),
    ).length;

    worksheet.getCell(`A${summaryRow + 1}`).value = "Total Transactions:";
    worksheet.getCell(`B${summaryRow + 1}`).value = transactions.length;
    worksheet.getCell(`B${summaryRow + 1}`).font = { bold: true };

    worksheet.getCell(`A${summaryRow + 2}`).value = "Total Amount:";
    worksheet.getCell(`B${summaryRow + 2}`).value = totalAmount;
    worksheet.getCell(`B${summaryRow + 2}`).numFmt = '"Rs." #,##0.00';
    worksheet.getCell(`B${summaryRow + 2}`).font = { bold: true };

    worksheet.getCell(`A${summaryRow + 3}`).value = "Paid (Approved):";
    worksheet.getCell(`B${summaryRow + 3}`).value = paidCount;
    worksheet.getCell(`B${summaryRow + 3}`).font = {
      color: { argb: "FF059669" },
    };

    worksheet.getCell(`A${summaryRow + 4}`).value = "Pending/Rejected:";
    worksheet.getCell(`B${summaryRow + 4}`).value = unpaidCount;
    worksheet.getCell(`B${summaryRow + 4}`).font = {
      color: { argb: "FFd97706" },
    };

    // Format amount column
    worksheet.getColumn(4).numFmt = '"Rs." #,##0.00';

    // Add borders to data table
    const lastDataRow = 4 + transactions.length;
    for (let i = 4; i <= lastDataRow; i++) {
      const row = worksheet.getRow(i);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=petty-cash-report-${Date.now()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Excel export error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get balance overview with committed expenses
// @route   GET /api/reports/balance-overview
// @access  Private
exports.getBalanceOverview = async (req, res) => {
  try {
    // Get current balance
    const balance = await Balance.findOne()
      .sort({ lastUpdated: -1 })
      .populate("lastUpdatedBy", "name email");

    if (!balance) {
      return res.status(404).json({
        success: false,
        message: "Balance record not found",
      });
    }

    // Get pending (committed) expenses
    const pendingExpenses = await Transaction.find({
      status: { $in: ["pending", "pending_approval", "info_requested"] },
    });

    const committedAmount = pendingExpenses.reduce(
      (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
      0,
    );

    const availableFunds = balance.currentBalance - committedAmount;

    // Get recent fund transfers
    const recentTransfers = await FundTransfer.find()
      .sort({ transferDate: -1 })
      .limit(10)
      .populate("transferredBy", "name email");

    // Get historical ledger (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = await Transaction.find({
      status: "approved",
      approvedAt: { $gte: thirtyDaysAgo },
    })
      .sort({ approvedAt: -1 })
      .populate("category", "name code")
      .populate("submittedBy", "name email");

    const totalIn = recentTransfers.reduce(
      (sum, t) => sum + (t.amount || 0),
      0,
    );

    const totalOut = recentTransactions.reduce(
      (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
      0,
    );

    res.status(200).json({
      success: true,
      data: {
        currentBalance: balance.currentBalance,
        committedExpenses: committedAmount,
        availableFunds: availableFunds,
        openingBalance: balance.openingBalance || 0,
        lastUpdated: balance.lastUpdated,
        lastUpdatedBy: balance.lastUpdatedBy,
        summary: {
          totalTransfersIn: totalIn,
          totalExpensesOut: totalOut,
          netChange: totalIn - totalOut,
        },
        pendingExpensesCount: pendingExpenses.length,
        historicalLedger: {
          transfers: recentTransfers,
          expenses: recentTransactions,
        },
      },
    });
  } catch (error) {
    console.error("Balance overview error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get reconciliation report
// @route   GET /api/reports/reconciliation
// @access  Private (Admin, Approver, Auditor)
exports.getReconciliationReport = async (req, res) => {
  try {
    const { startDate, endDate, actualCash } = req.query;

    // Get balance record
    const balance = await Balance.findOne().sort({ lastUpdated: -1 });

    if (!balance) {
      return res.status(404).json({
        success: false,
        message: "Balance record not found",
      });
    }

    // Calculate expected balance
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get all transfers
    const transfers = await FundTransfer.find(
      dateFilter.createdAt ? { createdAt: dateFilter } : {},
    );

    const totalTransfers = transfers.reduce((sum, t) => sum + t.amount, 0);

    // Get all approved expenses
    const expenses = await Transaction.find({
      status: "approved",
      ...(dateFilter.approvedAt && { approvedAt: dateFilter }),
    });

    const totalExpenses = expenses.reduce(
      (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
      0,
    );

    const expectedBalance =
      (balance.openingBalance || 0) + totalTransfers - totalExpenses;

    // Calculate discrepancy
    const actualCashAmount = actualCash ? parseFloat(actualCash) : null;
    const discrepancy = actualCashAmount
      ? actualCashAmount - expectedBalance
      : null;

    // Get discrepancy details if any
    let discrepancyAnalysis = null;
    if (discrepancy && Math.abs(discrepancy) > 0.01) {
      const pendingExpenses = await Transaction.find({
        status: { $in: ["pending", "pending_approval"] },
      });

      discrepancyAnalysis = {
        amount: discrepancy,
        percentage: ((discrepancy / expectedBalance) * 100).toFixed(2),
        possibleReasons: [],
      };

      if (discrepancy < 0) {
        discrepancyAnalysis.possibleReasons.push(
          "Unrecorded expenses or cash disbursements",
        );
        if (pendingExpenses.length > 0) {
          discrepancyAnalysis.possibleReasons.push(
            `${pendingExpenses.length} pending expense(s) not yet approved`,
          );
        }
      } else {
        discrepancyAnalysis.possibleReasons.push(
          "Unrecorded fund transfers or returns",
        );
      }
    }

    res.status(200).json({
      success: true,
      data: {
        openingBalance: balance.openingBalance || 0,
        totalTransfersIn: totalTransfers,
        totalExpensesOut: totalExpenses,
        expectedBalance: expectedBalance,
        actualCash: actualCashAmount,
        discrepancy: discrepancy,
        discrepancyAnalysis: discrepancyAnalysis,
        systemBalance: balance.currentBalance,
        reconciliationDate: new Date(),
        period: {
          start: startDate || "N/A",
          end: endDate || "N/A",
        },
        breakdown: {
          transferCount: transfers.length,
          expenseCount: expenses.length,
        },
      },
    });
  } catch (error) {
    console.error("Reconciliation report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
