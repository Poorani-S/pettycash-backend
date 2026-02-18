const reportService = require("./services/reportService");
const mongoose = require("mongoose");
require("dotenv").config();

async function testCEOReport() {
  try {
    console.log("\n🔍 Testing CEO Report Generation...\n");

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB connected\n");

    // Get admin user (replace with your admin user ID)
    const User = require("./models/User");
    const admin = await User.findOne({ role: "admin" });

    if (!admin) {
      console.error("❌ No admin user found in database");
      process.exit(1);
    }

    console.log(`📋 Admin User: ${admin.name} (${admin.email})`);
    console.log(`📧 CEO Email: ${process.env.CEO_EMAIL}`);
    console.log(
      `🔑 SendGrid API Key: ${process.env.SENDGRID_API_KEY ? "✅ Set" : "❌ Not Set"}\n`,
    );

    console.log("📄 Generating and sending CEO report...\n");

    // Call the sendAdminReportToCEO function
    const result = await reportService.sendAdminReportToCEO(admin._id);

    console.log("\n📊 Result:");
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log("\n✅ SUCCESS! CEO report sent successfully!");
      console.log(`   Transactions included: ${result.transactionCount}`);
      console.log(`   Message: ${result.message}`);
    } else {
      console.log("\n❌ FAILED to send CEO report");
      console.log(`   Error: ${result.error || result.message}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error("\nStack trace:");
    console.error(error.stack);
    process.exit(1);
  }
}

testCEOReport();
