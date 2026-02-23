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
 * Notify employee about approval/rejection
 */
const notifyExpenseStatusUpdate = async (
  transaction,
  employee,
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
            <p>Hello ${employee.name},</p>
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

    await sendEmail(employee.email, subject, htmlContent);
    return { success: true };
  } catch (error) {
    console.error("Notification error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Notify employee when approver requests additional information
 */
const notifyAdditionalInfoRequested = async (
  transaction,
  employee,
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
            <p>Hello ${employee.name},</p>
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

    await sendEmail(employee.email, subject, htmlContent);
    return { success: true };
  } catch (error) {
    console.error("Notification error:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send user invitation email with login credentials and access link
 */
const sendUserInvitation = async (
  user,
  tempPassword,
  additionalEmails = [],
) => {
  try {
    const subject = `🎉 Welcome to Pettica$h - Account Created & Ready to Use`;

    // Prepare email recipients: send to main email and additional domain variants (.com and.in)
    let recipients = [user.email];

    // Add .com and .in domain variants
    const emailParts = user.email.split("@");
    if (emailParts.length === 2) {
      const emailName = emailParts[0];
      const emailDomain = emailParts[1];

      // If current domain is not .com or .in, add both variants
      if (!emailDomain.includes(".com") && !emailDomain.includes(".in")) {
        recipients.push(
          `${emailName}@${emailDomain.replace(/\.[^.]+$/, ".com")}`,
        );
        recipients.push(
          `${emailName}@${emailDomain.replace(/\.[^.]+$/, ".in")}`,
        );
      } else if (emailDomain.endsWith(".com")) {
        // If current is .com, also add .in
        recipients.push(emailName + "@" + emailDomain.replace(".com", ".in"));
      } else if (emailDomain.endsWith(".in")) {
        // If current is .in, also add .com
        recipients.push(emailName + "@" + emailDomain.replace(".in", ".com"));
      }
    }

    // Add any additional emails provided
    if (additionalEmails && Array.isArray(additionalEmails)) {
      recipients = [...new Set([...recipients, ...additionalEmails])];
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 650px; margin: 20px auto; background: #f9f9f9; }
          .header { background: linear-gradient(135deg, #023e8a 0%, #0077b6 100%); color: white; padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { margin: 0 0 10px 0; font-size: 28px; font-weight: 600; }
          .header p { margin: 0; font-size: 16px; opacity: 0.95; }
          .content { background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .welcome-text { font-size: 16px; margin-bottom: 30px; color: #333; }
          .user-info-box { background: linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%); border: 2px solid #0077b6; border-radius: 10px; padding: 25px; margin: 25px 0; }
          .user-info-title { font-size: 18px; font-weight: 700; color: #023e8a; margin-bottom: 15px; }
          .credential-row { margin: 15px 0; }
          .credential-label { font-weight: 600; color: #023e8a; font-size: 14px; margin-bottom: 5px; display: block; }
          .credential-value { background: #023e8a; color: white; padding: 12px 16px; border-radius: 6px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 500; word-break: break-all; }
          .security-warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0; }
          .security-warning strong { color: #856404; }
          .security-warning p { margin: 5px 0; font-size: 14px; color: #856404; }
          .login-info { background: #e8f5e9; border: 1px solid #4caf50; border-radius: 6px; padding: 20px; margin: 25px 0; }
          .login-info h3 { color: #2e7d32; margin-top: 0; font-size: 16px; }
          .login-info p { margin: 10px 0; color: #333; font-size: 14px; }
          .login-button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0077b6 0%, #023e8a 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 25px 0; text-align: center; transition: transform 0.2s; }
          .login-button:hover { transform: translateY(-2px); }
          .access-methods { background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .access-methods h3 { color: #023e8a; font-size: 15px; margin-top: 0; }
          .access-methods ol { margin: 10px 0; padding-left: 20px; }
          .access-methods li { margin: 8px 0; color: #555; font-size: 14px; }
          .support-section { background: #f8f8f8; border-left: 4px solid #0077b6; padding: 15px; margin: 25px 0; border-radius: 4px; }
          .footer { text-align: center; padding: 25px 20px; color: #888; font-size: 12px; border-top: 1px solid #e0e0e0; background: #fafafa; border-radius: 0 0 12px 12px; }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Pettica$h!</h1>
            <p>Your Account is Ready - Let's Get Started</p>
          </div>
          <div class="content">
            <div class="welcome-text">
              <p>Hello <strong>${user.name}</strong>,</p>
              <p>Your Pettica$h Management System account has been successfully created! Below are your login credentials and instructions to access the system.</p>
            </div>

            <div class="user-info-box">
              <div class="user-info-title">👤 Your Account Information</div>
              
              <div class="credential-row">
                <span class="credential-label">📧 Login Email (User ID):</span>
                <div class="credential-value">${user.email}</div>
              </div>

              ${
                tempPassword
                  ? `
              <div class="credential-row">
                <span class="credential-label">🔐 Temporary Password:</span>
                <div class="credential-value">${tempPassword}</div>
              </div>
              `
                  : ""
              }

              <div class="credential-row">
                <span class="credential-label">👥 Role:</span>
                <div class="credential-value">${user.role.charAt(0).toUpperCase() + user.role.slice(1).toUpperCase()}</div>
              </div>

              ${
                user.approvalLimit
                  ? `
              <div class="credential-row">
                <span class="credential-label">💰 Approval Limit:</span>
                <div class="credential-value">₹${user.approvalLimit.toLocaleString()}</div>
              </div>
              `
                  : ""
              }
            </div>

            ${
              tempPassword
                ? `
            <div class="security-warning">
              <strong>⚠️ Important Security Notice:</strong>
              <p>✓ Keep your password confidential and do not share it with anyone</p>
              <p>✓ Consider changing your password on first login for added security</p>
              <p>✓ Always logout when you're done using the system, especially on shared computers</p>
            </div>
            `
                : ""
            }

            <div class="login-info">
              <h3>🔓 How to Access Your Account</h3>
              
              <div class="access-methods">
                <h3>Two Methods to Login:</h3>
                <ol>
                  <li><strong>Using Your Credentials</strong> - Enter your email and ${tempPassword ? "password provided above" : "an OTP (One-Time Password) sent to your email"}</li>
                  <li><strong>Using OTP</strong> - Click "Send OTP" on the login page to receive a secure one-time code</li>
                </ol>
              </div>

              <p><strong>For Enhanced Security:</strong> We recommend using OTP (One-Time Password) for your first login, which provides an additional layer of protection.</p>
            </div>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/login" class="login-button">
                ➜ Login to Pettica$h
              </a>
            </div>

            <div class="support-section">
              <strong>📧 Need Help?</strong>
              <p>If you experience any issues accessing your account or have questions about using the system, please contact your system administrator.</p>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Thank you for being part of the Pettica$h ecosystem. We're committed to making petty cash management efficient and transparent for your organization.
            </p>
          </div>
          <div class="footer">
            <p><strong>Pettica$h</strong> - Petty Cash Management System</p>
            <p>This is an automated invitation email. Please do not reply to this message.</p>
            <p>Email sent on ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to all recipients (main email + .com and .in variants)
    console.log(`📧 Sending user invitation to: ${recipients.join(", ")}`);

    for (const recipient of recipients) {
      const result = await sendEmail(recipient, subject, htmlContent);
      if (!result.success) {
        console.error(
          `Failed to send invitation to ${recipient}:`,
          result.error,
        );
      } else {
        console.log(`✅ Invitation sent to ${recipient}`);
      }
    }

    return { success: true, recipientsSent: recipients };
  } catch (error) {
    console.error("❌ Invitation email error:", error);
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
