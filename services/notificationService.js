const { sendEmail } = require("./emailService");
const User = require("../models/User");

/**
 * Notify approver about new expense submission
 */
const notifyExpenseSubmitted = async (transaction, submitter, approvers) => {
  try {
    const subject = `New Expense Awaiting Your Approval - ₹${transaction.postTaxAmount}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #023e8a, #0077b6); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .detail-row { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .label { font-weight: bold; color: #023e8a; }
          .amount { font-size: 24px; font-weight: bold; color: #0077b6; }
          .button { display: inline-block; padding: 12px 30px; background: #0077b6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">📝 New Expense Submission</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Pending Your Approval</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>A new expense has been submitted and requires your approval:</p>
            
            <div class="detail-row">
              <span class="label">Transaction Number:</span> ${transaction.transactionNumber}
            </div>
            <div class="detail-row">
              <span class="label">Submitted By:</span> ${submitter.name} (${submitter.email})
            </div>
            <div class="detail-row">
              <span class="label">Category:</span> ${transaction.category?.name || "N/A"}
            </div>
            <div class="detail-row">
              <span class="label">Payee:</span> ${transaction.payeeClientName}
            </div>
            <div class="detail-row">
              <span class="label">Purpose:</span> ${transaction.purpose}
            </div>
            <div class="detail-row">
              <span class="label">Amount:</span> <span class="amount">₹${transaction.postTaxAmount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date:</span> ${new Date(transaction.transactionDate).toLocaleDateString()}
            </div>
            
            <p style="margin-top: 20px;">Please review and approve/reject this expense at your earliest convenience.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/transactions" class="button">
                Review Expense
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from Pettica$h Management System</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to all approvers
    for (const approver of approvers) {
      await sendEmail(approver.email, subject, htmlContent);
    }

    return { success: true };
  } catch (error) {
    console.error("Notification error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify custodian about approval/rejection
 */
const notifyExpenseStatusUpdate = async (
  transaction,
  custodian,
  approver,
  status,
  comments,
) => {
  try {
    const isApproved = status === "approved";
    const subject = `Expense ${isApproved ? "Approved" : "Rejected"} - ${transaction.transactionNumber}`;

    const statusColor = isApproved ? "#10b981" : "#ef4444";
    const statusIcon = isApproved ? "✅" : "❌";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .detail-row { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .label { font-weight: bold; color: #023e8a; }
          .amount { font-size: 24px; font-weight: bold; color: ${statusColor}; }
          .comment-box { background: #f0f9ff; border-left: 4px solid #0077b6; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 30px; background: #0077b6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${statusIcon} Expense ${isApproved ? "Approved" : "Rejected"}</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${transaction.transactionNumber}</p>
          </div>
          <div class="content">
            <p>Hello ${custodian.name},</p>
            <p>Your expense submission has been <strong>${isApproved ? "approved" : "rejected"}</strong> by ${approver.name}.</p>
            
            <div class="detail-row">
              <span class="label">Transaction Number:</span> ${transaction.transactionNumber}
            </div>
            <div class="detail-row">
              <span class="label">Payee:</span> ${transaction.payeeClientName}
            </div>
            <div class="detail-row">
              <span class="label">Amount:</span> <span class="amount">₹${transaction.postTaxAmount.toFixed(2)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span> <strong style="color: ${statusColor};">${isApproved ? "APPROVED" : "REJECTED"}</strong>
            </div>
            
            ${
              comments
                ? `
            <div class="comment-box">
              <strong>Approver's Comments:</strong>
              <p style="margin: 10px 0 0 0;">${comments}</p>
            </div>
            `
                : ""
            }
            
            ${
              isApproved
                ? '<p style="color: #10b981; font-weight: bold;">✓ The expense has been approved and the petty cash balance has been updated.</p>'
                : '<p style="color: #ef4444; font-weight: bold;">✗ Please review the comments and resubmit if necessary.</p>'
            }
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/transactions" class="button">
                View Details
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from Pettica$h Management System</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(custodian.email, subject, htmlContent);
    return { success: true };
  } catch (error) {
    console.error("Notification error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify custodian when approver requests additional information
 */
const notifyAdditionalInfoRequested = async (
  transaction,
  custodian,
  approver,
  requestMessage,
) => {
  try {
    const subject = `Additional Information Required - ${transaction.transactionNumber}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .detail-row { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .label { font-weight: bold; color: #023e8a; }
          .request-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 12px 30px; background: #0077b6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">ℹ️ Additional Information Requested</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${transaction.transactionNumber}</p>
          </div>
          <div class="content">
            <p>Hello ${custodian.name},</p>
            <p>The approver ${approver.name} has requested additional information for your expense submission:</p>
            
            <div class="detail-row">
              <span class="label">Transaction Number:</span> ${transaction.transactionNumber}
            </div>
            <div class="detail-row">
              <span class="label">Amount:</span> ₹${transaction.postTaxAmount.toFixed(2)}
            </div>
            
            <div class="request-box">
              <strong>Requested Information:</strong>
              <p style="margin: 10px 0 0 0;">${requestMessage}</p>
            </div>
            
            <p>Please provide the requested information and update the transaction.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/transactions" class="button">
                Update Transaction
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated notification from Pettica$h Management System</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(custodian.email, subject, htmlContent);
    return { success: true };
  } catch (error) {
    console.error("Notification error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send user invitation email with OTP setup instructions
 */
const sendUserInvitation = async (user, tempPassword) => {
  try {
    const subject = `Welcome to Pettica$h - Your Account is Ready`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #023e8a, #0077b6); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .credential-box { background: #f0f9ff; border: 2px solid #0077b6; padding: 20px; margin: 20px 0; border-radius: 10px; }
          .credential { font-family: monospace; background: #023e8a; color: white; padding: 10px; border-radius: 5px; margin: 5px 0; }
          .steps { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .step { margin: 15px 0; padding-left: 30px; position: relative; }
          .step-number { position: absolute; left: 0; top: 0; background: #0077b6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; }
          .button { display: inline-block; padding: 12px 30px; background: #0077b6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">🎉 Welcome to Pettica$h!</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Account Has Been Created</p>
          </div>
          <div class="content">
            <p>Hello ${user.name},</p>
            <p>Your account has been created in the Pettica$h Management System. Here are your account details:</p>
            
            <div class="credential-box">
              <h3 style="margin-top: 0; color: #023e8a;">Your Login Credentials</h3>
              <p><strong>Email:</strong></p>
              <div class="credential">${user.email}</div>
              <p><strong>Role:</strong> ${user.role.toUpperCase()}</p>
              ${user.approvalLimit ? `<p><strong>Approval Limit:</strong> ₹${user.approvalLimit.toLocaleString()}</p>` : ""}
            </div>
            
            <div class="steps">
              <h3 style="margin-top: 0; color: #023e8a;">Getting Started</h3>
              <div class="step">
                <span class="step-number">1</span>
                <strong>Visit the Login Page</strong>
                <p>Go to the Pettica$h login page</p>
              </div>
              <div class="step">
                <span class="step-number">2</span>
                <strong>Enter Your Email</strong>
                <p>Use the email address shown above</p>
              </div>
              <div class="step">
                <span class="step-number">3</span>
                <strong>Request OTP</strong>
                <p>Click "Send OTP" to receive a one-time password via email</p>
              </div>
              <div class="step">
                <span class="step-number">4</span>
                <strong>Enter OTP</strong>
                <p>Check your email for the 6-digit code and enter it to login</p>
              </div>
            </div>
            
            <p><strong>Note:</strong> This system uses OTP-based authentication for enhanced security. You will receive a new OTP each time you login.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/login" class="button">
                Login Now
              </a>
            </div>
            
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px;">
              If you have any questions or need assistance, please contact your system administrator.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated notification from Pettica$h Management System</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(user.email, subject, htmlContent);
    return { success: true };
  } catch (error) {
    console.error("Invitation email error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify admin about failed login attempts
 */
const notifyAdminFailedLogin = async (user) => {
  try {
    // Find all admins
    const admins = await User.find({ role: "admin", isActive: true });

    if (admins.length === 0) {
      console.warn("No active admins found to notify");
      return { success: false, error: "No admins found" };
    }

    const subject = `🚨 Security Alert: Multiple Failed Login Attempts - ${user.name}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          .detail-row { margin: 10px 0; padding: 10px; background: #fef2f2; border-radius: 5px; border-left: 4px solid #dc2626; }
          .label { font-weight: bold; color: #dc2626; }
          .alert-box { background: #fef2f2; border: 2px solid #dc2626; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 30px; background: #0077b6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">🚨 Security Alert</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Multiple Failed Login Attempts Detected</p>
          </div>
          <div class="content">
            <div class="alert-box">
              <strong>⚠️ Action Required:</strong> A user account has been locked due to multiple failed login attempts.
            </div>
            
            <p>The following user has exceeded the maximum number of failed login attempts:</p>
            
            <div class="detail-row">
              <span class="label">User Name:</span> ${user.name}
            </div>
            <div class="detail-row">
              <span class="label">Email:</span> ${user.email}
            </div>
            <div class="detail-row">
              <span class="label">Phone:</span> ${user.phone || "N/A"}
            </div>
            <div class="detail-row">
              <span class="label">Role:</span> ${user.role}
            </div>
            <div class="detail-row">
              <span class="label">Failed Attempts:</span> ${user.failedPasswordAttempts || 3}
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> ${new Date().toLocaleString()}
            </div>
            <div class="detail-row">
              <span class="label">Account Locked Until:</span> ${user.accountLockedUntil ? new Date(user.accountLockedUntil).toLocaleString() : "15 minutes from now"}
            </div>
            
            <p style="margin-top: 20px;">
              <strong>Recommended Actions:</strong>
            </p>
            <ul>
              <li>Verify this is a legitimate user attempting to login</li>
              <li>Contact the user if this seems suspicious</li>
              <li>Review recent activity from this account</li>
              <li>Consider resetting the user's password if needed</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/users" class="button">
                View User Management
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated security notification from Pettica$h Management System</p>
            <p>Please do not reply to this email</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to all admins
    for (const admin of admins) {
      await sendEmail(admin.email, subject, htmlContent);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed login notification error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send transaction history to admin via email
 */
const sendTransactionHistoryToAdmin = async (transactions, period) => {
  try {
    const admins = await User.find({ role: "admin", isActive: true });

    if (admins.length === 0) {
      return { success: false, error: "No admins found" };
    }

    const subject = `📊 Transaction History Report - ${period}`;

    let transactionRows = "";
    let totalAmount = 0;

    transactions.forEach((t, index) => {
      totalAmount += t.postTaxAmount || t.amount || 0;
      transactionRows += `
        <tr style="background: ${index % 2 === 0 ? "#f9fafb" : "white"};">
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.transactionNumber || "N/A"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${new Date(t.transactionDate || t.createdAt).toLocaleDateString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.payeeClientName || "N/A"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.category?.name || "N/A"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">₹${(t.postTaxAmount || t.amount || 0).toLocaleString()}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">
            <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; background: ${t.status === "approved" ? "#d1fae5" : t.status === "pending" ? "#fef3c7" : "#fee2e2"}; color: ${t.status === "approved" ? "#065f46" : t.status === "pending" ? "#92400e" : "#991b1b"};">
              ${(t.status || "pending").toUpperCase()}
            </span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${t.submittedBy?.name || "N/A"}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 900px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #023e8a, #0077b6); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #023e8a; color: white; padding: 12px 10px; text-align: left; }
          .summary { display: flex; gap: 20px; margin-bottom: 20px; }
          .summary-card { background: #f3f4f6; padding: 15px; border-radius: 8px; flex: 1; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">📊 Transaction History Report</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Period: ${period}</p>
          </div>
          <div class="content">
            <div class="summary">
              <div class="summary-card">
                <strong>Total Transactions</strong>
                <p style="font-size: 24px; margin: 5px 0; color: #0077b6;">${transactions.length}</p>
              </div>
              <div class="summary-card">
                <strong>Total Amount</strong>
                <p style="font-size: 24px; margin: 5px 0; color: #0077b6;">₹${totalAmount.toLocaleString()}</p>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Transaction #</th>
                  <th>Date</th>
                  <th>Payee</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Submitted By</th>
                </tr>
              </thead>
              <tbody>
                ${transactionRows || '<tr><td colspan="7" style="text-align: center; padding: 20px;">No transactions found</td></tr>'}
              </tbody>
            </table>
          </div>
          <div class="footer">
            <p>This is an automated report from Pettica$h Management System</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    for (const admin of admins) {
      await sendEmail(admin.email, subject, htmlContent);
    }

    return { success: true };
  } catch (error) {
    console.error("Transaction history email error:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
  notifyExpenseSubmitted,
  notifyExpenseStatusUpdate,
  notifyAdditionalInfoRequested,
  sendUserInvitation,
  notifyAdminFailedLogin,
  sendTransactionHistoryToAdmin,
};
