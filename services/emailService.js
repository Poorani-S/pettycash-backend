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
 */
const sendEmail = async (to, subject, htmlContent) => {
  try {
    // Use SendGrid if API key is available (production)
    if (process.env.SENDGRID_API_KEY) {
      console.log("📧 Sending email via SendGrid to:", to);

      const msg = {
        to: to,
        from: process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER,
        subject: subject,
        html: htmlContent,
      };

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

      await transporter.sendMail(mailOptions);
      console.log("✅ Email sent via SMTP");
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
