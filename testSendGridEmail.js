const sgMail = require("@sendgrid/mail");
require("dotenv").config();

async function testSendGridEmail() {
  console.log("\n🔍 Testing SendGrid Email Configuration...\n");

  // Check environment variables
  console.log("📋 Configuration Check:");
  console.log(
    `   SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? "✅ Set" : "❌ Not Set"}`,
  );
  console.log(`   SENDGRID_FROM_EMAIL: ${process.env.SENDGRID_FROM_EMAIL}`);
  console.log(`   CEO_EMAIL: ${process.env.CEO_EMAIL}`);
  console.log("");

  if (!process.env.SENDGRID_API_KEY) {
    console.error("❌ SENDGRID_API_KEY is not set in .env file");
    process.exit(1);
  }

  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: process.env.CEO_EMAIL || "mikeykalai17@gmail.com",
      from: process.env.SENDGRID_FROM_EMAIL || "poorani372006@gmail.com",
      subject: "Test Email from Kambaa Petty Cash",
      text: "This is a test email to verify SendGrid configuration.",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #0077b6;">SendGrid Test Email</h1>
            <p>This is a test email from your Kambaa Petty Cash Management System.</p>
            <p>If you receive this email, SendGrid is configured correctly! ✅</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Sent on: ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `,
    };

    console.log("📧 Sending test email...");
    console.log(`   From: ${msg.from}`);
    console.log(`   To: ${msg.to}`);
    console.log("");

    const response = await sgMail.send(msg);

    console.log("✅ Email sent successfully!");
    console.log(`   Status Code: ${response[0].statusCode}`);
    console.log("");
    console.log("📬 Please check the inbox (and spam folder) of:", msg.to);
    console.log("");
  } catch (error) {
    console.error("❌ Error sending email:");
    console.error("");

    if (error.response) {
      console.error("Response Status:", error.response.statusCode);
      console.error(
        "Response Body:",
        JSON.stringify(error.response.body, null, 2),
      );
      console.error("");

      // Check for common errors
      if (error.response.body.errors) {
        error.response.body.errors.forEach((err) => {
          if (err.message.includes("not a verified sender")) {
            console.error("⚠️  SENDER EMAIL NOT VERIFIED!");
            console.error("");
            console.error("📝 To fix this:");
            console.error(
              "   1. Go to: https://app.sendgrid.com/settings/sender_auth/senders",
            );
            console.error(
              "   2. Click 'Create New Sender' or 'Verify' existing sender",
            );
            console.error(
              "   3. Verify email: " +
                (process.env.SENDGRID_FROM_EMAIL || "poorani372006@gmail.com"),
            );
            console.error("   4. Check your email for verification link");
            console.error("");
          } else if (err.message.includes("API key")) {
            console.error("⚠️  INVALID API KEY!");
            console.error("");
            console.error("📝 To fix this:");
            console.error(
              "   1. Go to: https://app.sendgrid.com/settings/api_keys",
            );
            console.error(
              "   2. Create a new API key with 'Mail Send' permissions",
            );
            console.error("   3. Update SENDGRID_API_KEY in .env file");
            console.error("");
          }
        });
      }
    } else {
      console.error("Error message:", error.message);
    }
  }

  process.exit(0);
}

testSendGridEmail();
