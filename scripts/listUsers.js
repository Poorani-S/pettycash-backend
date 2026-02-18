const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

/**
 * List All Users and Their Details
 * Note: Passwords are hashed with bcrypt and cannot be retrieved.
 * Refer to seedData.js for test user credentials.
 */

const listUsers = async () => {
  try {
    console.log("🔄 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to database\n");

    const users = await User.find({}).sort({ role: 1, name: 1 });

    console.log("📊 USER LIST");
    console.log("=".repeat(80));
    console.log(
      `Total Users: ${users.length} (Active: ${users.filter((u) => u.isActive).length})\n`,
    );

    // Group by role
    const roles = [
      "admin",
      "manager",
      "employee",
      "intern",
      "auditor",
      "approver",
    ];

    for (const role of roles) {
      const roleUsers = users.filter((u) => u.role === role);
      if (roleUsers.length === 0) continue;

      console.log(`\n${"=".repeat(80)}`);
      console.log(`${role.toUpperCase()}S (${roleUsers.length})`);
      console.log("=".repeat(80));

      roleUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone || "N/A"}`);
        console.log(`   Department: ${user.department || "N/A"}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Active: ${user.isActive ? "✅ Yes" : "❌ No"}`);
        console.log(
          `   Has Password: ${user.hasPassword ? "✅ Yes" : "❌ No"}`,
        );
        console.log(`   Employee Number: ${user.employeeNumber || "N/A"}`);
        console.log(
          `   Last Login: ${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}`,
        );
        console.log(`   Failed Attempts: ${user.failedPasswordAttempts || 0}`);
        console.log(
          `   Account Locked: ${user.accountLockedUntil && user.accountLockedUntil > new Date() ? "🔒 Yes" : "No"}`,
        );
        console.log(
          `   Created: ${new Date(user.createdAt).toLocaleDateString()}`,
        );
      });
    }

    console.log("\n\n" + "=".repeat(80));
    console.log("📝 TEST USER CREDENTIALS (from seedData.js)");
    console.log("=".repeat(80));
    console.log("\n1. Admin:");
    console.log("   📧 Email: poorani372006@gmail.com");
    console.log("   🔑 Password: admin123");
    console.log("\n2. Manager:");
    console.log("   📧 Email: poorani6380045604@gmail.com");
    console.log("   🔑 Password: manager123");
    console.log("\n3. Employee:");
    console.log("   📧 Email: 241cd030@srcw.ac.in");
    console.log("   🔑 Password: employee123");
    console.log("\n📧 CEO Email (for reports): mikeykalai17@gmail.com");
    console.log(
      "\n💡 Note: If these passwords don't work, run: node seedData.js",
    );
    console.log("=".repeat(80) + "\n");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
};

// Run the script
listUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
