const nodemailer = require("nodemailer");
const sgMail = require("@sendgrid/mail");

// Configure SendGrid (for production)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Configure SMTP (for development)
const createSMTPTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: port,
    secure: isSecure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
};

/**
 * Send email using SendGrid (production) or SMTP (development)
 * @param {string} to - Recipient email address(es) — single address or comma-separated list
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 * @param {Array} attachments - Optional array of attachment objects:
 *   { filename: string, content: Buffer, contentType: string }
 */
const sendEmail = async (to, subject, htmlContent, attachments = []) => {
  try {
    console.log("📧 Email Config Debug:");
    console.log("   - EMAIL_HOST:", process.env.EMAIL_HOST);
    console.log("   - EMAIL_PORT:", process.env.EMAIL_PORT);
    console.log(
      "   - EMAIL_USER:",
      process.env.EMAIL_USER ? "✓ Set" : "✗ Not Set",
    );
    console.log(
      "   - EMAIL_PASSWORD:",
      process.env.EMAIL_PASSWORD ? "✓ Set" : "✗ Not Set",
    );
    console.log(
      "   - SENDGRID_API_KEY:",
      process.env.SENDGRID_API_KEY ? "✓ Set" : "✗ Not Set",
    );

    // Use SendGrid if API key is available (production)
    if (process.env.SENDGRID_API_KEY) {
      console.log("📧 Sending email via SendGrid to:", to);

      const msg = {
        to: to,
        from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER,
        subject: subject,
        html: htmlContent,
      };

      // Add attachments in SendGrid format
      if (attachments && attachments.length > 0) {
        msg.attachments = attachments.map((att) => ({
          content: Buffer.isBuffer(att.content)
            ? att.content.toString("base64")
            : Buffer.from(att.content).toString("base64"),
          filename: att.filename,
          type: att.contentType || "application/octet-stream",
          disposition: "attachment",
        }));
      }

      await sgMail.send(msg);
      console.log("✅ Email sent via SendGrid");
      return { success: true };
    }
    // Fallback to SMTP (development/local)
    else {
      console.log("📧 Sending email via SMTP to:", to);

      const transporter = createSMTPTransporter();
      const mailOptions = {
        from: process.env.EMAIL_FROM || `Pettyca$h <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent,
      };

      // Add attachments in nodemailer format
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent via SMTP. Message ID:", info.messageId);
      return { success: true };
    }
  } catch (error) {
    console.error("❌ Email send error:", error.message);
    console.error("Error details:", error.response?.body || error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
};
