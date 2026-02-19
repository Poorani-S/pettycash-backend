const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const nodemailer = require("nodemailer");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const fs = require("fs");
const path = require("path");
const { addPDFHeader, addPDFFooter, LOGO_PATH } = require("../utils/pdfHeader");

// Email configuration
const emailPort = parseInt(process.env.EMAIL_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: emailPort,
  secure: emailPort === 465, // true for 465, false for other ports (587 uses STARTTLS)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Generate PDF report with Kambaa logo
 */
const generatePDFReport = async (transactions, adminUser) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add reusable header with logo
      const contentStartY = addPDFHeader(doc, "PETTY CASH EXPENSE REPORT");
      doc.y = contentStartY;

      // Report Info
      const reportInfoY = doc.y + 10;
      const boxHeight = 50;
      const boxWidth = 495;

      // Draw info box with border
      doc
        .rect(50, reportInfoY, boxWidth, boxHeight)
        .lineWidth(2)
        .strokeColor("#0077b6")
        .stroke();

      // Left side - Report Period and Date
      doc
        .fontSize(10)
        .fillColor("#0077b6")
        .text("Report Period: month - Present", 60, reportInfoY + 10, {
          width: 240,
        })
        .fillColor("#333")
        .text(
          `Generated On: ${new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          60,
          reportInfoY + 25,
          { width: 240 },
        );

      // Right side - Transaction stats
      const totalTransactions = transactions.length;
      const totalAmount = transactions.reduce(
        (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
        0,
      );

      doc
        .fillColor("#0077b6")
        .text(
          `Total Transactions: ${totalTransactions}`,
          310,
          reportInfoY + 10,
          { width: 230 },
        )
        .fillColor("#333")
        .text(
          `Total Amount: Rs.${totalAmount.toLocaleString("en-IN")}`,
          310,
          reportInfoY + 25,
          { width: 230 },
        );

      doc.moveDown(4);

      // Summary Section
      const approvedCount = transactions.filter(
        (t) => t.status === "approved",
      ).length;
      const pendingCount = transactions.filter(
        (t) => t.status === "pending" || t.status === "pending_manager",
      ).length;
      const rejectedCount = transactions.filter(
        (t) => t.status === "rejected",
      ).length;

      doc
        .fontSize(12)
        .fillColor("#023e8a")
        .text("SUMMARY", { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .fillColor("#333")
        .text(
          `Paid (Approved): ${approvedCount} transactions - Rs.${transactions
            .filter((t) => t.status === "approved")
            .reduce((sum, t) => sum + (t.postTaxAmount || t.amount || 0), 0)
            .toLocaleString("en-IN")}`,
          { indent: 20 },
        )
        .moveDown(0.3)
        .text(
          `Pending/Rejected: ${pendingCount + rejectedCount} transactions`,
          { indent: 20 },
        )
        .moveDown(2);

      // Transactions Table Header
      doc
        .fontSize(12)
        .fillColor("#023e8a")
        .text("Transaction Details", { underline: true })
        .moveDown(0.5);

      // Table
      const tableTop = doc.y;
      const itemHeight = 20;
      let currentY = tableTop;

      // Headers with better column names matching screenshot
      doc
        .fontSize(9)
        .fillColor("#fff")
        .rect(50, currentY, 495, 20)
        .fill("#023e8a");

      doc
        .fillColor("#fff")
        .text("Date", 55, currentY + 5, { width: 65 })
        .text("User", 120, currentY + 5, { width: 90 })
        .text("Amount", 210, currentY + 5, { width: 70 })
        .text("Reason", 280, currentY + 5, { width: 100 })
        .text("Status", 380, currentY + 5, { width: 70 })
        .text("Paid", 450, currentY + 5, { width: 40 })
        .text("Payment Mode", 490, currentY + 5, { width: 50 });

      currentY += itemHeight;

      // Rows
      transactions.forEach((transaction, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        const bgColor = index % 2 === 0 ? "#f9f9f9" : "#ffffff";
        doc.rect(50, currentY, 495, itemHeight).fill(bgColor);

        // Format date as shown in screenshot (27/1/2026)
        const transDate = new Date(transaction.transactionDate);
        const formattedDate = `${transDate.getDate()}/${transDate.getMonth() + 1}/${transDate.getFullYear()}`;

        // Determine status color
        const statusColor =
          transaction.status === "approved"
            ? "#28a745"
            : transaction.status === "pending" ||
                transaction.status === "pending_manager"
              ? "#ffc107"
              : "#dc3545";

        doc
          .fontSize(8)
          .fillColor("#333")
          .text(formattedDate, 55, currentY + 5, { width: 65 })
          .text(
            transaction.requestedBy?.name?.substring(0, 15) ||
              transaction.payeeClientName?.substring(0, 15) ||
              "N/A",
            120,
            currentY + 5,
            { width: 90 },
          )
          .text(
            `Rs.${(transaction.postTaxAmount || transaction.amount || 0).toLocaleString("en-IN")}`,
            210,
            currentY + 5,
            { width: 70 },
          )
          .text(
            transaction.purpose?.substring(0, 18) || "N/A",
            280,
            currentY + 5,
            { width: 100 },
          )
          .fillColor(statusColor)
          .text(
            transaction.status === "approved"
              ? "Paid"
              : transaction.status?.charAt(0).toUpperCase() +
                  transaction.status?.slice(1) || "Pending",
            380,
            currentY + 5,
            { width: 70 },
          )
          .fillColor(transaction.status === "approved" ? "#dc3545" : "#28a745")
          .text(
            transaction.status === "approved" ? "No" : "Yes",
            450,
            currentY + 5,
            { width: 40 },
          )
          .fillColor("#333")
          .text(
            transaction.paymentMethod?.toUpperCase() || "CASH",
            490,
            currentY + 5,
            {
              width: 50,
            },
          );

        currentY += itemHeight;
      });

      // Footer - matching screenshot format
      const footerY = 750;
      doc
        .fontSize(8)
        .fillColor("#666")
        .text(
          "This is a system-generated report from Kambaa Petty Cash Management System",
          50,
          footerY,
          { align: "center", width: 495 },
        )
        .text(
          `Generated by: ${adminUser.name} | Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}, ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`,
          50,
          footerY + 12,
          { align: "center", width: 495 },
        )
        .text("Confidential - For Internal Use Only", 50, footerY + 24, {
          align: "center",
          width: 495,
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate Excel report
 */
const generateExcelReport = async (transactions, adminUser) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Admin Transactions");

    // Set column widths
    worksheet.columns = [
      { header: "Transaction Number", key: "transactionNumber", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Payee", key: "payee", width: 25 },
      { header: "Purpose", key: "purpose", width: 30 },
      { header: "Category", key: "category", width: 20 },
      { header: "Amount (Rs.)", key: "amount", width: 15 },
      { header: "Tax (Rs.)", key: "tax", width: 12 },
      { header: "Total Amount (Rs.)", key: "totalAmount", width: 18 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Submitted By", key: "submittedBy", width: 20 },
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF023e8a" },
    };
    worksheet.getRow(1).alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    // Add data rows
    transactions.forEach((transaction) => {
      worksheet.addRow({
        transactionNumber: transaction.transactionNumber || "N/A",
        date: new Date(transaction.transactionDate).toLocaleDateString("en-IN"),
        payee: transaction.payeeClientName || "N/A",
        purpose: transaction.purpose || "N/A",
        category: transaction.category?.name || "N/A",
        amount: transaction.amount || 0,
        tax:
          (transaction.postTaxAmount || transaction.amount || 0) -
          (transaction.amount || 0),
        totalAmount: transaction.postTaxAmount || transaction.amount || 0,
        paymentMethod: transaction.paymentMethod || "N/A",
        status: transaction.status?.toUpperCase() || "N/A",
        submittedBy: transaction.requestedBy?.name || "N/A",
      });
    });

    // Add summary at the bottom
    worksheet.addRow({});
    const summaryRow = worksheet.addRow({
      transactionNumber: "SUMMARY",
      totalAmount: transactions.reduce(
        (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
        0,
      ),
    });
    summaryRow.font = { bold: true };
    summaryRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Format number columns
    worksheet.getColumn("amount").numFmt = "#,##0.00";
    worksheet.getColumn("tax").numFmt = "#,##0.00";
    worksheet.getColumn("totalAmount").numFmt = "#,##0.00";

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    throw error;
  }
};

/**
 * Send admin transaction report to CEO
 */
const sendAdminReportToCEO = async (adminUserId) => {
  try {
    // Get admin user
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("User is not an admin");
    }

    // Get all transactions (admin sees everything)
    const transactions = await Transaction.find()
      .populate("requestedBy", "name email")
      .populate("category", "name")
      .sort({ transactionDate: -1 })
      .limit(100); // Last 100 transactions

    if (transactions.length === 0) {
      console.log("No transactions to report");
      return { success: false, message: "No transactions found" };
    }

    // Generate PDF and Excel reports
    const pdfBuffer = await generatePDFReport(transactions, adminUser);
    const excelBuffer = await generateExcelReport(transactions, adminUser);

    // Prepare email
    const ceoEmail = process.env.CEO_EMAIL || "mikeykalai17@gmail.com";
    const reportDate = new Date().toLocaleDateString("en-IN");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #023e8a, #0077b6); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .summary-box { background: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0077b6; }
          .stat { margin: 10px 0; font-size: 14px; }
          .stat-label { font-weight: bold; color: #023e8a; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">KAMBAA</div>
            <h2 style="margin: 0;">Admin Transaction History Report</h2>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Automated Daily Report</p>
          </div>
          <div class="content">
            <p>Dear CEO,</p>
            <p>Please find attached the comprehensive transaction history report for admin activities.</p>
            
            <div class="summary-box">
              <h3 style="margin-top: 0; color: #023e8a;">Report Summary</h3>
              <div class="stat">
                <span class="stat-label">Report Date:</span> ${reportDate}
              </div>
              <div class="stat">
                <span class="stat-label">Admin:</span> ${adminUser.name} (${adminUser.email})
              </div>
              <div class="stat">
                <span class="stat-label">Total Transactions:</span> ${transactions.length}
              </div>
              <div class="stat">
                <span class="stat-label">Total Amount:</span> Rs.${transactions
                  .reduce(
                    (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
                    0,
                  )
                  .toLocaleString("en-IN")}
              </div>
              <div class="stat">
                <span class="stat-label">Approved:</span> ${
                  transactions.filter((t) => t.status === "approved").length
                }
              </div>
              <div class="stat">
                <span class="stat-label">Pending:</span> ${
                  transactions.filter(
                    (t) =>
                      t.status === "pending" || t.status === "pending_manager",
                  ).length
                }
              </div>
              <div class="stat">
                <span class="stat-label">Rejected:</span> ${
                  transactions.filter((t) => t.status === "rejected").length
                }
              </div>
            </div>
            
            <p><strong>Attachments:</strong></p>
            <ul>
              <li>📄 <strong>PDF Report</strong> - Detailed formatted report with all transactions</li>
              <li>📊 <strong>Excel Report</strong> - Complete data export for analysis</li>
            </ul>
            
            <p>Both reports include the Kambaa logo and essential transaction details including date, payee, purpose, amount, status, and more.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>Kambaa Petty Cash Management System</p>
          </div>
          <div class="footer">
            <p><strong>KAMBAA</strong> - Petty Cash Management System</p>
            <p>This is an automated report. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || "Kambaa Petty Cash <noreply@kambaa.com>",
      to: ceoEmail,
      subject: `Admin Transaction Report - ${reportDate} | Kambaa`,
      html: htmlContent,
      attachments: [
        {
          filename: `Admin_Transaction_Report_${new Date().toISOString().split("T")[0]}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
        {
          filename: `Admin_Transaction_Report_${new Date().toISOString().split("T")[0]}.xlsx`,
          content: excelBuffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(`Admin report sent to CEO: ${ceoEmail}`);

    return {
      success: true,
      message: `Report sent to ${ceoEmail}`,
      transactionCount: transactions.length,
    };
  } catch (error) {
    console.error("Error sending admin report to CEO:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Trigger report on admin transaction actions
 */
const triggerAdminReportOnTransaction = async (transaction, adminUser) => {
  try {
    // Only send report if the action was performed by an admin
    if (adminUser.role !== "admin") {
      return;
    }

    // Send the report
    await sendAdminReportToCEO(adminUser._id);
  } catch (error) {
    console.error("Error triggering admin report:", error);
  }
};

module.exports = {
  generatePDFReport,
  generateExcelReport,
  sendAdminReportToCEO,
  triggerAdminReportOnTransaction,
};
