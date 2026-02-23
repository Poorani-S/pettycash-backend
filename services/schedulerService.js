const cron = require("node-cron");
const LoginActivity = require("../models/LoginActivity");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { sendEmail } = require("./emailService");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { addPDFHeader } = require("../utils/pdfHeader");

/**
 * Generate login activity report for the past week
 */
const generateLoginActivityReport = async (format = "both") => {
  try {
    // Calculate date range for the past week
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Fetch login activities for the past week
    const loginActivities = await LoginActivity.find({
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("user", "name email role department")
      .sort({ timestamp: -1 })
      .lean();

    // Group statistics
    const stats = {
      totalLogins: loginActivities.length,
      successfulLogins: loginActivities.filter(
        (a) => a.loginStatus === "success",
      ).length,
      failedLogins: loginActivities.filter((a) => a.loginStatus === "failed")
        .length,
      passwordLogins: loginActivities.filter(
        (a) => a.loginMethod === "password",
      ).length,
      otpLogins: loginActivities.filter((a) => a.loginMethod === "otp").length,
    };

    // User-wise statistics
    const userStats = {};
    loginActivities.forEach((activity) => {
      const email = activity.email;
      if (!userStats[email]) {
        userStats[email] = {
          name: activity.name,
          email: activity.email,
          role: activity.role,
          totalAttempts: 0,
          successful: 0,
          failed: 0,
          passwordLogins: 0,
          otpLogins: 0,
        };
      }
      userStats[email].totalAttempts++;
      if (activity.loginStatus === "success") {
        userStats[email].successful++;
      } else {
        userStats[email].failed++;
      }
      if (activity.loginMethod === "password") {
        userStats[email].passwordLogins++;
      } else {
        userStats[email].otpLogins++;
      }
    });

    const reports = {};

    // Generate Excel report
    if (format === "excel" || format === "both") {
      reports.excel = await generateExcelLoginReport(
        loginActivities,
        stats,
        userStats,
        startDate,
        endDate,
      );
    }

    // Generate PDF report
    if (format === "pdf" || format === "both") {
      reports.pdf = await generatePDFLoginReport(
        loginActivities,
        stats,
        userStats,
        startDate,
        endDate,
      );
    }

    return { success: true, reports, stats };
  } catch (error) {
    console.error("Error generating login activity report:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Generate Excel login activity report
 */
const generateExcelLoginReport = async (
  activities,
  stats,
  userStats,
  startDate,
  endDate,
) => {
  const workbook = new ExcelJS.Workbook();

  // Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 30 },
    { header: "Value", key: "value", width: 20 },
  ];

  summarySheet.addRows([
    {
      metric: "Report Period",
      value: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
    },
    { metric: "Total Login Attempts", value: stats.totalLogins },
    { metric: "Successful Logins", value: stats.successfulLogins },
    { metric: "Failed Logins", value: stats.failedLogins },
    { metric: "Password Logins", value: stats.passwordLogins },
    { metric: "OTP Logins", value: stats.otpLogins },
  ]);

  // Style summary sheet
  summarySheet.getRow(1).font = { bold: true, size: 12 };
  summarySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0077B6" },
  };
  summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // User Statistics Sheet
  const userStatsSheet = workbook.addWorksheet("User Statistics");
  userStatsSheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Role", key: "role", width: 15 },
    { header: "Total Attempts", key: "totalAttempts", width: 18 },
    { header: "Successful", key: "successful", width: 15 },
    { header: "Failed", key: "failed", width: 15 },
    { header: "Password Logins", key: "passwordLogins", width: 18 },
    { header: "OTP Logins", key: "otpLogins", width: 15 },
  ];

  Object.values(userStats).forEach((user) => {
    userStatsSheet.addRow(user);
  });

  // Style user stats header
  userStatsSheet.getRow(1).font = { bold: true };
  userStatsSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0077B6" },
  };
  userStatsSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Detailed Activity Log Sheet
  const activitySheet = workbook.addWorksheet("Activity Log");
  activitySheet.columns = [
    { header: "Timestamp", key: "timestamp", width: 20 },
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Role", key: "role", width: 15 },
    { header: "Login Method", key: "loginMethod", width: 15 },
    { header: "Status", key: "loginStatus", width: 12 },
    { header: "Failure Reason", key: "failureReason", width: 25 },
    { header: "IP Address", key: "ipAddress", width: 18 },
  ];

  activities.forEach((activity) => {
    activitySheet.addRow({
      timestamp: new Date(activity.timestamp).toLocaleString(),
      name: activity.name,
      email: activity.email,
      role: activity.role,
      loginMethod: activity.loginMethod.toUpperCase(),
      loginStatus: activity.loginStatus.toUpperCase(),
      failureReason: activity.failureReason || "N/A",
      ipAddress: activity.ipAddress || "N/A",
    });
  });

  // Style activity log header
  activitySheet.getRow(1).font = { bold: true };
  activitySheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0077B6" },
  };
  activitySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

/**
 * Generate PDF login activity report
 */
const generatePDFLoginReport = async (
  activities,
  stats,
  userStats,
  startDate,
  endDate,
) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Add header
      const contentStartY = addPDFHeader(doc, "WEEKLY LOGIN ACTIVITY REPORT");
      doc.y = contentStartY;

      // Report Period
      doc
        .fontSize(12)
        .fillColor("#0077b6")
        .text(
          `Report Period: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          {
            align: "center",
          },
        );
      doc.moveDown();

      // Summary Section
      doc
        .fontSize(14)
        .fillColor("#023e8a")
        .text("Summary", { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(10).fillColor("#333");
      doc.text(`Total Login Attempts: ${stats.totalLogins}`);
      doc.text(`Successful Logins: ${stats.successfulLogins}`);
      doc.text(`Failed Logins: ${stats.failedLogins}`);
      doc.text(`Password Logins: ${stats.passwordLogins}`);
      doc.text(`OTP Logins: ${stats.otpLogins}`);
      doc.moveDown();

      // User Statistics Section
      doc
        .fontSize(14)
        .fillColor("#023e8a")
        .text("User Statistics", { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(8);
      const userStatsArray = Object.values(userStats);
      userStatsArray.forEach((user) => {
        doc
          .fillColor("#0077b6")
          .text(`${user.name} (${user.email})`, { continued: false });
        doc
          .fillColor("#333")
          .text(
            `  Total: ${user.totalAttempts} | Success: ${user.successful} | Failed: ${user.failed} | Password: ${user.passwordLogins} | OTP: ${user.otpLogins}`,
          );
        doc.moveDown(0.3);
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate transaction/expense Excel report
 */
const generateExcelTransactionReport = async (
  transactions,
  stats,
  startDate,
  endDate,
) => {
  try {
    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet("Summary");
    summarySheet.columns = [
      { header: "Metric", key: "metric", width: 30 },
      { header: "Value", key: "value", width: 20 },
    ];

    summarySheet.addRows([
      {
        metric: "Report Period",
        value: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
      },
      { metric: "Total Transactions", value: stats.totalTransactions },
      {
        metric: "Total Amount",
        value: `₹${stats.totalAmount.toLocaleString("en-IN")}`,
      },
      { metric: "Approved", value: stats.approved },
      { metric: "Pending", value: stats.pending },
      { metric: "Rejected", value: stats.rejected },
    ]);

    // Style summary
    summarySheet.getRow(1).font = { bold: true, size: 12 };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF023e8a" },
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    // Detailed Transactions Sheet
    const transactionSheet = workbook.addWorksheet("Transactions");
    transactionSheet.columns = [
      { header: "Transaction #", key: "number", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Payee", key: "payee", width: 25 },
      { header: "Category", key: "category", width: 20 },
      { header: "Amount (₹)", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Submitted By", key: "submittedBy", width: 20 },
      { header: "Purpose", key: "purpose", width: 30 },
    ];

    transactions.forEach((t) => {
      transactionSheet.addRow({
        number: t.transactionNumber || "N/A",
        date: new Date(t.transactionDate || t.createdAt).toLocaleDateString(),
        payee: t.payeeClientName || "N/A",
        category: t.category?.name || "N/A",
        amount: t.postTaxAmount || t.amount || 0,
        status: (t.status || "pending").toUpperCase(),
        submittedBy: t.submittedBy?.name || "N/A",
        purpose: t.purpose || "N/A",
      });
    });

    // Style transaction header
    transactionSheet.getRow(1).font = { bold: true };
    transactionSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF023e8a" },
    };
    transactionSheet.getRow(1).font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
    };

    // Format currency
    transactionSheet.getColumn("amount").numFmt = "#,##0.00";

    return await workbook.xlsx.writeBuffer();
  } catch (error) {
    console.error("Error generating transaction Excel report:", error);
    throw error;
  }
};

/**
 * Generate transaction/expense PDF report
 */
const generatePDFTransactionReport = async (
  transactions,
  stats,
  startDate,
  endDate,
) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc
        .fontSize(24)
        .fillColor("#023e8a")
        .text("PETTY CASH", { align: "center" });
      doc.fontSize(14).text("Weekly Transaction Report", { align: "center" });
      doc
        .fontSize(10)
        .fillColor("#666")
        .text(
          `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
          { align: "center" },
        );
      doc.moveDown(0.5);

      // Summary Section
      doc
        .fontSize(12)
        .fillColor("#023e8a")
        .text("Summary", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#333");
      doc.text(`Total Transactions: ${stats.totalTransactions}`);
      doc.text(`Total Amount: ₹${stats.totalAmount.toLocaleString("en-IN")}`);
      doc.text(
        `Approved: ${stats.approved} | Pending: ${stats.pending} | Rejected: ${stats.rejected}`,
      );
      doc.moveDown();

      // Transactions Table
      doc
        .fontSize(12)
        .fillColor("#023e8a")
        .text("Transaction Details", { underline: true });
      doc.moveDown(0.3);

      doc.fontSize(8);
      const tableTop = doc.y;
      const itemHeight = 18;
      let currentY = tableTop;

      // Table header
      doc.rect(40, currentY, 515, 20).fill("#023e8a");
      doc
        .fillColor("#fff")
        .text("Date", 45, currentY + 5, { width: 70 })
        .text("Payee", 115, currentY + 5, { width: 100 })
        .text("Amount", 215, currentY + 5, { width: 70 })
        .text("Status", 285, currentY + 5, { width: 80 })
        .text("Submitted By", 365, currentY + 5, { width: 90 })
        .text("Purpose", 455, currentY + 5, { width: 100 });

      currentY += 20;

      // Table rows
      transactions.slice(0, 20).forEach((t, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 40;
        }

        const bgColor = index % 2 === 0 ? "#f9f9f9" : "#ffffff";
        doc.rect(40, currentY, 515, itemHeight).fill(bgColor);

        doc
          .fillColor("#333")
          .text(
            new Date(t.transactionDate || t.createdAt).toLocaleDateString(),
            45,
            currentY + 4,
            { width: 70 },
          )
          .text(t.payeeClientName || "N/A", 115, currentY + 4, { width: 100 })
          .text(
            `₹${(t.postTaxAmount || t.amount || 0).toLocaleString()}`,
            215,
            currentY + 4,
            { width: 70 },
          )
          .text((t.status || "pending").toUpperCase(), 285, currentY + 4, {
            width: 80,
          })
          .text(t.submittedBy?.name || "N/A", 365, currentY + 4, { width: 90 })
          .text((t.purpose || "N/A").substring(0, 20), 455, currentY + 4, {
            width: 100,
          });

        currentY += itemHeight;
      });

      if (transactions.length > 20) {
        currentY += 10;
        doc
          .fontSize(8)
          .fillColor("#666")
          .text(
            `... and ${transactions.length - 20} more transactions (see Excel report for full details)`,
            { align: "center" },
          );
      }

      // Footer
      doc
        .fontSize(8)
        .fillColor("#666")
        .text(
          "This is an automated report from Pettica$h Management System. Generated on " +
            new Date().toLocaleString(),
          40,
          750,
          { align: "center" },
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Send comprehensive weekly report to CEO - combines login activity and transactions
 */
const sendComprehensiveWeeklyReport = async () => {
  let transporter;
  try {
    console.log("📊 Generating comprehensive weekly CEO report...");

    // Get CEO email and variants
    const ceoEmailBase = process.env.CEO_EMAIL || "ceo@example.com";
    let ceoEmails = [ceoEmailBase];

    // Add .com and .in variants
    const emailParts = ceoEmailBase.split("@");
    if (emailParts.length === 2) {
      const emailName = emailParts[0];
      const emailDomain = emailParts[1];

      if (!emailDomain.includes(".com") && !emailDomain.includes(".in")) {
        ceoEmails.push(
          `${emailName}@${emailDomain.replace(/\.[^.]+$/, ".com")}`,
        );
        ceoEmails.push(
          `${emailName}@${emailDomain.replace(/\.[^.]+$/, ".in")}`,
        );
      } else if (emailDomain.endsWith(".com")) {
        ceoEmails.push(emailName + "@" + emailDomain.replace(".com", ".in"));
      } else if (emailDomain.endsWith(".in")) {
        ceoEmails.push(emailName + "@" + emailDomain.replace(".in", ".com"));
      }
    }

    // Calculate date range for past 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    console.log(
      `📅 Report Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
    );

    // Generate Login Activity Report
    console.log("📝 Generating login activity report...");
    const loginReportResult = await generateLoginActivityReport("both");
    if (!loginReportResult.success) {
      throw new Error("Failed to generate login report");
    }
    const { reports: loginReports, stats: loginStats } = loginReportResult;

    // Generate Transaction Report
    console.log("📝 Generating transaction report...");
    const transactions = await Transaction.find({
      transactionDate: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("category", "name")
      .populate("submittedBy", "name email")
      .lean();

    const transactionStats = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce(
        (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
        0,
      ),
      pending: transactions.filter((t) => t.status === "pending").length,
      approved: transactions.filter((t) => t.status === "approved").length,
      rejected: transactions.filter((t) => t.status === "rejected").length,
    };

    const transactionExcelBuffer = await generateExcelTransactionReport(
      transactions,
      transactionStats,
      startDate,
      endDate,
    );
    const transactionPdfBuffer = await generatePDFTransactionReport(
      transactions,
      transactionStats,
      startDate,
      endDate,
    );

    // Create comprehensive email
    const reportDate = new Date().toLocaleDateString("en-IN");
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 750px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #023e8a 0%, #0077b6 100%); color: white; padding: 40px; text-align: center; }
          .header h1 { margin: 0 0 10px 0; font-size: 32px; }
          .header p { margin: 0; opacity: 0.95; }
          .content { padding: 40px; }
          .period-box { background: #e3f2fd; border-left: 4px solid #0077b6; padding: 15px; border-radius: 6px; margin-bottom: 30px; }
          .section { margin: 30px 0; }
          .section-title { font-size: 22px; color: #023e8a; border-bottom: 2px solid #0077b6; padding-bottom: 10px; margin-bottom: 20px; }
          .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .stat-card { background: #f0f9ff; border: 1px solid #b3e5fc; border-radius: 8px; padding: 20px; text-align: center; }
          .stat-label { font-size: 14px; color: #666; margin-bottom: 10px; }
          .stat-value { font-size: 28px; font-weight: bold; color: #0077b6; }
          .highlights { background: #f5f5f5; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .highlight-item { margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #ddd; }
          .highlight-item:last-child { border: none; }
          .attachments { background: #e8f5e9; border: 1px solid #81c784; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .attachments h3 { color: #2e7d32; margin-top: 0; }
          .attachment-list { list-style: none; padding: 0; }
          .attachment-list li { padding: 8px 0; margin-left: 20px; }
          .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Weekly CEO Report</h1>
            <p>Pettica$h Management System</p>
          </div>
          <div class="content">
            <div class="period-box">
              <strong>📅 Report Period:</strong> ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}
            </div>

            <!-- Login Activity Section -->
            <div class="section">
              <div class="section-title">🔐 User Login Activity</div>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Total Login Attempts</div>
                  <div class="stat-value">${loginStats.totalLogins}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Successful Logins</div>
                  <div class="stat-value">${loginStats.successfulLogins}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Failed Attempts</div>
                  <div class="stat-value">${loginStats.failedLogins}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">OTP Method</div>
                  <div class="stat-value">${loginStats.otpLogins}</div>
                </div>
              </div>
              <div class="highlights">
                <strong>📌 Key Insights:</strong>
                <div class="highlight-item">✓ Success Rate: ${((loginStats.successfulLogins / loginStats.totalLogins) * 100).toFixed(1)}%</div>
                <div class="highlight-item">✓ Password Logins: ${loginStats.passwordLogins} | OTP Logins: ${loginStats.otpLogins}</div>
              </div>
            </div>

            <!-- Transaction Section -->
            <div class="section">
              <div class="section-title">💰 Transaction Summary</div>
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Total Transactions</div>
                  <div class="stat-value">${transactionStats.totalTransactions}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Total Amount</div>
                  <div class="stat-value">₹${(transactionStats.totalAmount / 100000).toFixed(1)}L</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Approved</div>
                  <div class="stat-value" style="color: #4caf50;">${transactionStats.approved}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Pending</div>
                  <div class="stat-value" style="color: #ff9800;">${transactionStats.pending}</div>
                </div>
              </div>
              <div class="highlights">
                <strong>📌 Key Insights:</strong>
                <div class="highlight-item">✓ Total Amount: ₹${transactionStats.totalAmount.toLocaleString("en-IN")}</div>
                <div class="highlight-item">✓ Approved: ${transactionStats.approved} | Pending: ${transactionStats.pending} | Rejected: ${transactionStats.rejected}</div>
                <div class="highlight-item">✓ Average per Transaction: ₹${(transactionStats.totalAmount / (transactionStats.totalTransactions || 1)).toLocaleString("en-IN")}</div>
              </div>
            </div>

            <!-- Attachments -->
            <div class="attachments">
              <h3>📁 Attached Reports (PDF & Excel)</h3>
              <ul class="attachment-list">
                <li>✅ Weekly_Login_Activity_Report.pdf</li>
                <li>✅ Weekly_Login_Activity_Report.xlsx</li>
                <li>✅ Weekly_Transaction_Report.pdf</li>
                <li>✅ Weekly_Transaction_Report.xlsx</li>
              </ul>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #666;">All reports contain detailed breakdowns by user, department, and category.</p>
            </div>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              This comprehensive report combines user activity and transaction data for the past 7 days. All attachments include detailed analytics in Excel format and formatted summaries in PDF format.
            </p>
          </div>
          <div class="footer">
            <p><strong>Pettica$h</strong> - Petty Cash Management System</p>
            <p>Automated Weekly Report | Generated on ${reportDate} at ${new Date().toLocaleTimeString()}</p>
            <p>Please do not reply to this email. For support, contact your system administrator.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email with all attachments
    const nodemailer = require("nodemailer");
    const emailPort = parseInt(process.env.EMAIL_PORT) || 587;
    const isSecure = emailPort === 465;

    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: emailPort,
      secure: isSecure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    const mailOptions = {
      from:
        process.env.EMAIL_FROM ||
        process.env.EMAIL_USER ||
        "noreply@kambaa.com",
      to: ceoEmails.join(", "),
      subject: `📊 Weekly CEO Report - ${reportDate} | Pettica$h`,
      html: htmlContent,
      attachments: [
        {
          filename: `Weekly_Login_Activity_Report.pdf`,
          content: loginReports.pdf,
          contentType: "application/pdf",
        },
        {
          filename: `Weekly_Login_Activity_Report.xlsx`,
          content: loginReports.excel,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        {
          filename: `Weekly_Transaction_Report.pdf`,
          content: transactionPdfBuffer,
          contentType: "application/pdf",
        },
        {
          filename: `Weekly_Transaction_Report.xlsx`,
          content: transactionExcelBuffer,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ],
    };

    console.log(
      `📧 Sending comprehensive weekly report to: ${ceoEmails.join(", ")}`,
    );
    const info = await transporter.sendMail(mailOptions);

    console.log(
      `✅ Comprehensive weekly report sent successfully. Message ID: ${info.messageId}`,
    );
    return {
      success: true,
      recipients: ceoEmails,
      transactionCount: transactions.length,
    };
  } catch (error) {
    console.error(
      "❌ Error sending comprehensive weekly report:",
      error.message,
    );
    return { success: false, error: error.message };
  }
};

/**
 * Send weekly login activity report to CEO
 */
const sendWeeklyLoginReport = async () => {
  try {
    console.log("📊 Generating weekly login activity report...");

    // Redirect to comprehensive report
    return await sendComprehensiveWeeklyReport();
  } catch (error) {
    console.error("❌ Error sending weekly login report:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send weekly transaction/expense report to CEO (now delegated to comprehensive report)
 */
const sendWeeklyExpenseReport = async () => {
  try {
    console.log("📊 Generating weekly expense report...");
    // Redirect to comprehensive report
    return await sendComprehensiveWeeklyReport();
  } catch (error) {
    console.error("❌ Error sending weekly expense report:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule weekly reports to be sent every Monday at 9 AM
 */
const scheduleWeeklyReports = () => {
  // Send comprehensive weekly report every Monday at 9:00 AM
  cron.schedule("0 9 * * 1", async () => {
    console.log("🔔 ========================================");
    console.log(
      "⏰ [SCHEDULER] Running scheduled comprehensive weekly CEO report...",
    );
    console.log("📅 Date: " + new Date().toLocaleString());
    console.log("🔔 ========================================");

    try {
      const result = await sendComprehensiveWeeklyReport();
      if (result.success) {
        console.log(
          `✅ [SCHEDULER] Comprehensive weekly report sent successfully to ${result.recipients.length} recipients`,
        );
        console.log(
          `📊 Report included data for ${result.transactionCount} transactions`,
        );
      } else {
        console.error(
          `❌ [SCHEDULER] Failed to send comprehensive weekly report: ${result.error}`,
        );
      }
    } catch (error) {
      console.error(
        `❌ [SCHEDULER] Unexpected error in weekly report scheduler:`,
        error,
      );
    }
  });

  console.log("📅 ========================================");
  console.log("📅 Weekly Comprehensive CEO Report Scheduled:");
  console.log("📅 - Every Monday at 09:00 AM (IST)");
  console.log("📅 - Includes: User Activity + Transactions");
  console.log("📅 - Format: HTML Email + PDF + Excel");
  console.log("📅 - Recipients: CEO email + .com + .in variants");
  console.log("📅 ========================================");
};

module.exports = {
  generateLoginActivityReport,
  generateExcelTransactionReport,
  generatePDFTransactionReport,
  sendComprehensiveWeeklyReport,
  sendWeeklyLoginReport,
  sendWeeklyExpenseReport,
  scheduleWeeklyReports,
};
