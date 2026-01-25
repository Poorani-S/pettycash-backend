const Transaction = require("../models/Transaction");
const FundTransfer = require("../models/FundTransfer");
const Balance = require("../models/Balance");
const Category = require("../models/Category");
const User = require("../models/User");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const path = require("path");
const fs = require("fs");

// Helper function to get date range
const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
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
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date();
  }

  return { startDate, endDate };
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
    } else if (period) {
      const range = getDateRange(period);
      dateFilter = {
        transactionDate: {
          $gte: range.startDate,
          $lte: range.endDate,
        },
      };
    }

    let matchQuery = { ...dateFilter };
    if (category) matchQuery.category = category;
    if (status) matchQuery.status = status;

    // Role-based filtering
    if (req.user.role === "handler") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    }

    const transactions = await Transaction.find(matchQuery)
      .populate("category", "name code")
      .populate("submittedBy", "name email")
      .sort({ transactionDate: -1 });

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce(
        (sum, t) => sum + (t.postTaxAmount || t.amount),
        0,
      ),
      approvedCount: transactions.filter((t) => t.status === "approved").length,
      approvedAmount: transactions
        .filter((t) => t.status === "approved")
        .reduce((sum, t) => sum + (t.postTaxAmount || t.amount), 0),
      pendingCount: transactions.filter((t) => t.status === "pending").length,
      pendingAmount: transactions
        .filter((t) => t.status === "pending")
        .reduce((sum, t) => sum + (t.postTaxAmount || t.amount), 0),
      rejectedCount: transactions.filter((t) => t.status === "rejected").length,
      rejectedAmount: transactions
        .filter((t) => t.status === "rejected")
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
    } else if (period) {
      const range = getDateRange(period);
      dateFilter = {
        transactionDate: {
          $gte: range.startDate,
          $lte: range.endDate,
        },
      };
    }

    let matchQuery = { ...dateFilter, status: "approved" };

    if (req.user.role === "handler") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    }

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

    if (req.user.role === "handler") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    }

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
    } else if (period) {
      const range = getDateRange(period);
      dateFilter = {
        transactionDate: {
          $gte: range.startDate,
          $lte: range.endDate,
        },
      };
    }

    let matchQuery = { ...dateFilter };
    if (category) matchQuery.category = category;
    if (status) matchQuery.status = status;

    if (req.user.role === "handler") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    }

    const transactions = await Transaction.find(matchQuery)
      .populate("category", "name code")
      .populate("submittedBy", "name email")
      .sort({ transactionDate: -1 });

    const totalAmount = transactions.reduce(
      (sum, t) => sum + (t.postTaxAmount || t.amount),
      0,
    );
    const approvedAmount = transactions
      .filter((t) => t.status === "approved")
      .reduce((sum, t) => sum + (t.postTaxAmount || t.amount), 0);
    const paidCount = transactions.filter(
      (t) => t.status === "approved",
    ).length;
    const unpaidCount = transactions.filter(
      (t) => t.status !== "approved",
    ).length;

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=petty-cash-report-${Date.now()}.pdf`,
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
      .text("PETTY CASH EXPENSE REPORT", 40, 100, { align: "center" })
      .moveDown(0.5);

    // Report Info Box
    const infoBoxY = 130;
    doc.rect(40, infoBoxY, 515, 50).fillAndStroke("#f0f9ff", "#0077b6");

    doc
      .fontSize(9)
      .fillColor("#023e8a")
      .text(
        `Report Period: ${startDate ? new Date(startDate).toLocaleDateString("en-IN") : period || "All Time"} - ${endDate ? new Date(endDate).toLocaleDateString("en-IN") : "Present"}`,
        50,
        infoBoxY + 10,
      )
      .text(
        `Generated On: ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        50,
        infoBoxY + 25,
      )
      .text(`Total Transactions: ${transactions.length}`, 300, infoBoxY + 10)
      .text(
        `Total Amount: Rs.${totalAmount.toLocaleString("en-IN")}`,
        300,
        infoBoxY + 25,
      );

    // Summary Section
    doc
      .fontSize(12)
      .fillColor("#023e8a")
      .text("SUMMARY", 40, 195, { underline: true })
      .moveDown(0.3);

    const summaryY = 210;
    doc
      .fontSize(9)
      .fillColor("#333")
      .text(
        `Paid (Approved): ${paidCount} transactions - Rs.${approvedAmount.toLocaleString("en-IN")}`,
        50,
        summaryY,
      )
      .text(`Pending/Rejected: ${unpaidCount} transactions`, 300, summaryY);

    // Table Header
    const tableTop = 245;
    const colWidths = [65, 80, 80, 90, 70, 65, 65];
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
    doc.fontSize(8);

    transactions.forEach((txn, index) => {
      // Check for page break
      if (yPos > 750) {
        doc.addPage();

        // Add logo on new page
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 20, { width: 60 });
        }
        doc
          .fontSize(10)
          .fillColor("#023e8a")
          .text("Petty Cash Report (Continued)", 110, 35);

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
      }

      // Alternate row colors
      if (index % 2 === 0) {
        doc.rect(40, yPos - 3, 515, 18).fill("#f8fafc");
      }

      const isPaid = txn.status === "approved";
      const paidStatus = isPaid ? "Yes" : "No";
      const paymentMode = txn.paymentMethod
        ? txn.paymentMethod.replace("_", " ").toUpperCase()
        : "N/A";

      xPos = 45;
      const rowData = [
        new Date(txn.transactionDate).toLocaleDateString("en-IN"),
        (txn.submittedBy?.name || txn.payeeClientName || "N/A").substring(
          0,
          12,
        ),
        `Rs.${(txn.postTaxAmount || txn.amount).toLocaleString("en-IN")}`,
        (txn.purpose || "N/A").substring(0, 15),
        txn.status.charAt(0).toUpperCase() + txn.status.slice(1),
        paidStatus,
        paymentMode.substring(0, 10),
      ];

      // Status color coding
      rowData.forEach((data, i) => {
        if (i === 4) {
          // Status column
          if (txn.status === "approved") {
            doc.fillColor("#059669");
          } else if (txn.status === "rejected") {
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
    } else if (period) {
      const range = getDateRange(period);
      dateFilter = {
        transactionDate: {
          $gte: range.startDate,
          $lte: range.endDate,
        },
      };
    }

    let matchQuery = { ...dateFilter };
    if (category) matchQuery.category = category;
    if (status) matchQuery.status = status;

    if (req.user.role === "handler") {
      matchQuery.$or = [
        { submittedBy: req.user._id },
        { requestedBy: req.user._id },
      ];
    }

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
      { header: "Amount (₹)", key: "amount", width: 15 },
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
      "Amount (₹)",
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

    // Add transaction data
    transactions.forEach((txn, index) => {
      const isPaid = txn.status === "approved";
      const row = worksheet.addRow({
        sno: index + 1,
        date: new Date(txn.transactionDate).toLocaleDateString("en-IN"),
        user: txn.submittedBy?.name || txn.payeeClientName || "N/A",
        amount: txn.postTaxAmount || txn.amount || 0,
        reason: txn.purpose || "N/A",
        paid: isPaid ? "Yes" : "No",
        status: txn.status.charAt(0).toUpperCase() + txn.status.slice(1),
        paymentMode: txn.paymentMethod
          ? txn.paymentMethod.replace("_", " ").toUpperCase()
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
      if (txn.status === "approved") {
        statusCell.font = { color: { argb: "FF059669" } };
      } else if (txn.status === "rejected") {
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
      (sum, t) => sum + (t.postTaxAmount || t.amount),
      0,
    );
    const paidCount = transactions.filter(
      (t) => t.status === "approved",
    ).length;
    const unpaidCount = transactions.filter(
      (t) => t.status !== "approved",
    ).length;

    worksheet.getCell(`A${summaryRow + 1}`).value = "Total Transactions:";
    worksheet.getCell(`B${summaryRow + 1}`).value = transactions.length;
    worksheet.getCell(`B${summaryRow + 1}`).font = { bold: true };

    worksheet.getCell(`A${summaryRow + 2}`).value = "Total Amount:";
    worksheet.getCell(`B${summaryRow + 2}`).value =
      `₹${totalAmount.toLocaleString("en-IN")}`;
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
    worksheet.getColumn(4).numFmt = "₹#,##0.00";

    // Add borders to data table
    for (let i = 4; i <= worksheet.rowCount - 6; i++) {
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
