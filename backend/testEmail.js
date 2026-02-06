// Test email sending
const dotenv = require("dotenv");
dotenv.config();

const { sendEmail } = require("./services/emailService");

const testEmail = async () => {
  console.log("\n========== EMAIL TEST ==========\n");

  console.log("Environment Variables:");
  console.log("EMAIL_HOST:", process.env.EMAIL_HOST);
  console.log("EMAIL_PORT:", process.env.EMAIL_PORT);
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log(
    "EMAIL_PASSWORD:",
    process.env.EMAIL_PASSWORD
      ? "[SET - " + process.env.EMAIL_PASSWORD.length + " chars]"
      : "[NOT SET]",
  );
  console.log("EMAIL_FROM:", process.env.EMAIL_FROM);
  console.log(
    "SENDGRID_API_KEY:",
    process.env.SENDGRID_API_KEY ? "[SET]" : "[NOT SET]",
  );

  console.log("\n--- Sending Test Email ---\n");

  // Send to the admin email as a test
  const testTo = process.env.EMAIL_USER; // Send to self for testing
  const testSubject = "Pettica$h - Email Test";
  const testHtml = `
    <h1>Email Test Successful!</h1>
    <p>If you received this email, the email configuration is working correctly.</p>
    <p>Sent at: ${new Date().toISOString()}</p>
  `;

  try {
    const result = await sendEmail(testTo, testSubject, testHtml);
    console.log("\nResult:", result);

    if (result.success) {
      console.log("\n✅ EMAIL TEST PASSED! Check your inbox at:", testTo);
    } else {
      console.log("\n❌ EMAIL TEST FAILED:", result.error);
    }
  } catch (error) {
    console.error("\n❌ EMAIL TEST ERROR:", error);
  }

  console.log("\n================================\n");
  process.exit(0);
};

testEmail();
