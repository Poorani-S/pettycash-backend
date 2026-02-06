const mongoose = require("mongoose");
require("dotenv").config();
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const FundTransfer = require("./models/FundTransfer");
const Category = require("./models/Category");

async function testAdminFeatures() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB\n");

    // Test 1: Check if admin user exists
    console.log("📋 Test 1: Checking Admin User...");
    const adminUsers = await User.find({ role: "admin" });
    console.log(`Found ${adminUsers.length} admin user(s):`);
    adminUsers.forEach((user) => {
      console.log(
        `  - ${user.name} (${user.email}) - Active: ${user.isActive}`,
      );
    });
    console.log();

    // Test 2: Check categories
    console.log("📋 Test 2: Checking Categories...");
    const categories = await Category.find();
    console.log(`Found ${categories.length} categories:`);
    categories.slice(0, 5).forEach((cat) => {
      console.log(`  - ${cat.name} (${cat.code}) - Active: ${cat.isActive}`);
    });
    console.log();

    // Test 3: Check transactions
    console.log("📋 Test 3: Checking Transactions...");
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(5);
    console.log(`Total transactions: ${await Transaction.countDocuments()}`);
    console.log(`Recent 5 transactions:`);
    transactions.forEach((tx) => {
      console.log(
        `  - ${tx.purpose || "No purpose"} - ₹${tx.postTaxAmount || tx.amount} - Status: ${tx.status}`,
      );
    });
    console.log();

    // Test 4: Check fund transfers
    console.log("📋 Test 4: Checking Fund Transfers...");
    const fundTransfers = await FundTransfer.find()
      .sort({ createdAt: -1 })
      .limit(5);
    console.log(`Total fund transfers: ${await FundTransfer.countDocuments()}`);
    console.log(`Recent 5 fund transfers:`);
    fundTransfers.forEach((ft) => {
      console.log(
        `  - ${ft.purpose || ft.notes || "Fund Transfer"} - ₹${ft.amount} - Type: ${ft.transferType}`,
      );
    });
    console.log();

    // Test 5: Check for legacy roles
    console.log("📋 Test 5: Checking for Legacy Roles...");
    const legacyUsers = await User.find({
      role: { $in: ["custodian", "handler"] },
    });
    if (legacyUsers.length > 0) {
      console.log(`⚠️  Found ${legacyUsers.length} users with legacy roles:`);
      legacyUsers.forEach((user) => {
        console.log(`  - ${user.name} (${user.email}) - Role: ${user.role}`);
      });
    } else {
      console.log("✅ No legacy roles found");
    }
    console.log();

    // Test 6: Check users by role
    console.log("📋 Test 6: User Distribution by Role...");
    const roleDistribution = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    roleDistribution.forEach((role) => {
      console.log(`  - ${role._id}: ${role.count} user(s)`);
    });
    console.log();

    console.log("✅ All diagnostic tests completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during diagnostic tests:", error);
    process.exit(1);
  }
}

testAdminFeatures();
