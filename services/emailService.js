const nodemailer = require("nodemailer");

// ── AWS SES transporter ──
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    tls: { rejectUnauthorized: false },
  });
};

// Sender identity
const SENDER_EMAIL = process.env.EMAIL_FROM || "contact@kambaa.ai";
const SENDER_WITH_NAME = `Petty Cash <${SENDER_EMAIL}>`;

/**
 * Strip emojis and special chars from subject lines.
 * Microsoft 365 EOP flags emoji-heavy subjects as spam.
 */
const cleanSubject = (subject) => {
  return subject
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u{200D}]/gu, "")
    .replace(/[\u{20E3}]/gu, "")
    .replace(/[\u{E0020}-\u{E007F}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
};

/**
 * Strip HTML to plain-text (critical for Microsoft 365 deliverability).
 */
const htmlToPlainText = (html) => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&copy;/g, "(c)")
    .replace(/₹/g, "Rs.")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

/**
 * Send email via AWS SES SMTP.
 * Subjects are auto-cleaned (emojis stripped) for Microsoft 365 compatibility.
 *
 * @param {string} to - Recipient email (single or comma-separated)
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML body
 * @param {Array}  attachments - Optional nodemailer attachment objects
 */
const sendEmail = async (to, subject, htmlContent, attachments = []) => {
  try {
    const safeSubject = cleanSubject(subject);

    console.log(`📧 Sending email via AWS SES`);
    console.log("   - From:", SENDER_WITH_NAME);
    console.log("   - To:", to);
    console.log("   - Subject:", safeSubject);

    const transporter = createTransporter();
    const mailOptions = {
      from: SENDER_WITH_NAME,
      to,
      replyTo: SENDER_EMAIL,
      subject: safeSubject,
      html: htmlContent,
      text: htmlToPlainText(htmlContent),
      headers: {
        "X-Mailer": "PettyCash-App",
        "X-Priority": "3",
        "List-Unsubscribe": `<mailto:${SENDER_EMAIL}?subject=unsubscribe>`,
      },
      encoding: "utf-8",
    };

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent via AWS SES. Message ID:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email send error:", error.message);
    console.error("Error details:", error.response || error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendEmail,
};

module.exports = {
  sendEmail,
};
