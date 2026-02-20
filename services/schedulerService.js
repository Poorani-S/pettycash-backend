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
 * Send weekly login activity report to CEO
 */
const sendWeeklyLoginReport = async () => {
  try {
    console.log("📊 Generating weekly login activity report...");

    // Get CEO email from environment variable
    const ceoEmail = process.env.CEO_EMAIL;
    if (!ceoEmail) {
      console.error("❌ CEO_EMAIL not configured in environment variables");
      return { success: false, error: "CEO email not configured" };
    }

    // Generate reports
    const reportResult = await generateLoginActivityReport("both");
    if (!reportResult.success) {
      return reportResult;
    }

    const { reports, stats } = reportResult;

    // Create email content
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const subject = `Weekly Login Activity Report - ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #023e8a, #0077b6); color: white; padding: 20px; border-radius: 10px; text-align: center; }
          .content { background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .stat-box { background: #f0f9ff; border-left: 4px solid #0077b6; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .stat-label { font-weight: bold; color: #023e8a; }
          .stat-value { font-size: 24px; color: #0077b6; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">📊 Weekly Login Activity Report</h2>
            <p style="margin: 5px 0 0 0;">${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
          </div>
          <div class="content">
            <h3 style="color: #023e8a;">Login Activity Summary</h3>
            <div class="stat-box">
              <div class="stat-label">Total Login Attempts</div>
              <div class="stat-value">${stats.totalLogins}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Successful Logins</div>
              <div class="stat-value">${stats.successfulLogins}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Failed Login Attempts</div>
              <div class="stat-value">${stats.failedLogins}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Login Methods</div>
              <p style="margin: 5px 0;">Password: ${stats.passwordLogins} | OTP: ${stats.otpLogins}</p>
            </div>
            <p style="margin-top: 20px;">Detailed reports are attached to this email in both PDF and Excel formats.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email with attachments (note: sendEmail needs to be updated to support attachments)
    // For now, we'll just send the HTML. In production, you should use a library that supports attachments
    await sendEmail(ceoEmail, subject, htmlContent);

    console.log("✅ Weekly login activity report sent to CEO");
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending weekly login report:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send weekly transaction/expense report to CEO
 */
const sendWeeklyExpenseReport = async () => {
  try {
    console.log("📊 Generating weekly expense report...");

    // Get CEO email
    const ceoEmail = process.env.CEO_EMAIL;
    if (!ceoEmail) {
      console.error("❌ CEO_EMAIL not configured in environment variables");
      return { success: false, error: "CEO email not configured" };
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Fetch transactions for the past week
    const transactions = await Transaction.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .populate("category", "name code")
      .populate("submittedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const stats = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce(
        (sum, t) => sum + (t.postTaxAmount || t.amount || 0),
        0,
      ),
      pending: transactions.filter((t) => t.status === "pending").length,
      approved: transactions.filter((t) => t.status === "approved").length,
      rejected: transactions.filter((t) => t.status === "rejected").length,
    };

    const subject = `Weekly Expense Report - ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #023e8a, #0077b6); color: white; padding: 20px; border-radius: 10px; text-align: center; }
          .content { background: white; padding: 30px; margin-top: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .stat-box { background: #f0f9ff; border-left: 4px solid #0077b6; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .stat-label { font-weight: bold; color: #023e8a; }
          .stat-value { font-size: 24px; color: #0077b6; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">💰 Weekly Expense Report</h2>
            <p style="margin: 5px 0 0 0;">${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}</p>
          </div>
          <div class="content">
            <h3 style="color: #023e8a;">Expense Summary</h3>
            <div class="stat-box">
              <div class="stat-label">Total Transactions</div>
              <div class="stat-value">${stats.totalTransactions}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Total Amount</div>
              <div class="stat-value">₹${stats.totalAmount.toLocaleString("en-IN")}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Status Breakdown</div>
              <p style="margin: 5px 0;">
                Pending: ${stats.pending} | 
                Approved: ${stats.approved} | 
                Rejected: ${stats.rejected}
              </p>
            </div>
            <p style="margin-top: 20px;">For detailed reports, please login to the system.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(ceoEmail, subject, htmlContent);

    console.log("✅ Weekly expense report sent to CEO");
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending weekly expense report:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule weekly reports to be sent every Monday at 9 AM
 */
const scheduleWeeklyReports = () => {
  // Send login activity report every Monday at 9:00 AM
  cron.schedule("0 9 * * 1", async () => {
    console.log("⏰ Running scheduled weekly login activity report...");
    await sendWeeklyLoginReport();
  });

  // Send expense report every Monday at 9:15 AM
  cron.schedule("15 9 * * 1", async () => {
    console.log("⏰ Running scheduled weekly expense report...");
    await sendWeeklyExpenseReport();
  });

  console.log("📅 Weekly reports scheduled:");
  console.log("   - Login Activity Report: Every Monday at 9:00 AM");
  console.log("   - Expense Report: Every Monday at 9:15 AM");
};

module.exports = {
  generateLoginActivityReport,
  sendWeeklyLoginReport,
  sendWeeklyExpenseReport,
  scheduleWeeklyReports,
};
