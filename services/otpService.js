const nodemailer = require("nodemailer");

// Email configuration with fallback options for cloud hosting
const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT) || 587;
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: port,
    secure: isSecure, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    debug: process.env.NODE_ENV === "development",
    logger: process.env.NODE_ENV === "development",
  });
};

const transporter = createTransporter();

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via email
const sendOTPEmail = async (email, otp, name) => {
  try {
    console.log("Attempting to send OTP to:", email);
    console.log("Email config:", {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: process.env.EMAIL_USER ? "***configured***" : "NOT SET",
      pass: process.env.EMAIL_PASSWORD ? "***configured***" : "NOT SET",
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM || "Kambaa <noreply@kambaa.com>",
      to: email,
      subject: "Your Kambaa Login OTP",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
            .otp-box { background: #f3f4f6; border: 2px dashed #3b82f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; }
            .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
            .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">Kambaa</h1>
              <p style="margin: 10px 0 0 0;">One-Time Password Verification</p>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>You have requested to log in to your Kambaa account. Please use the following One-Time Password (OTP) to proceed:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
                <p style="margin: 10px 0 0 0; color: #6b7280;">Valid for 10 minutes</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <p style="margin: 5px 0 0 0;">
                  This OTP is confidential. Do not share it with anyone. Our team will never ask for your OTP.
                </p>
              </div>
              
              <p>If you did not request this OTP, please ignore this email or contact your administrator immediately.</p>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>Kambaa Team</strong>
              </p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
              <p>&copy; 2026 Kambaa. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Hello ${name},
        
        Your Kambaa Login OTP is: ${otp}
        
        This OTP is valid for 10 minutes.
        
        If you did not request this, please ignore this email or contact your administrator.
        
        Best regards,
        Kambaa Team
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ OTP Email sent successfully:", info.messageId);
    console.log("Response:", info.response);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending OTP email:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error command:", error.command);
    console.error("Full error:", error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }
};

// Send OTP via SMS (placeholder - requires SMS gateway integration)
const sendOTPSMS = async (phone, otp, name) => {
  try {
    // TODO: Integrate with SMS gateway (Twilio, MSG91, etc.)
    console.log(`SMS OTP for ${phone}: ${otp}`);

    // Simulating SMS send for development
    if (process.env.NODE_ENV === "development") {
      console.log(`[DEV MODE] SMS would be sent to ${phone} with OTP: ${otp}`);
      return { success: true, message: "Development mode - SMS not sent" };
    }

    // Production SMS integration example (Twilio):
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    const message = await client.messages.create({
      body: `Your Kambaa OTP is: ${otp}. Valid for 10 minutes. Do not share this with anyone.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    
    return { success: true, sid: message.sid };
    */

    return { success: false, message: "SMS gateway not configured" };
  } catch (error) {
    console.error("Error sending OTP SMS:", error);
    throw new Error("Failed to send OTP SMS");
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
  sendOTPSMS,
};
