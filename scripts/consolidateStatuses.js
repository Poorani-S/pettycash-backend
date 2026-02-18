const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
require("dotenv").config();

/**
 * Migration Script: Consolidate Transaction Statuses
 *
 * Reduces transaction statuses from 7 to 3 categories:
 * - approved (includes: approved, paid)
 * - rejected (includes: rejected)
 * - pending (includes: draft, pending, pending_approval, info_requested)
 */

const consolidateStatuses = async () => {
  try {
    console.log("🔄 Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to database");

    console.log("\n📊 Fetching current transaction status distribution...");
    const statusCounts = await Transaction.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    console.log("\n📈 Current Status Distribution:");
    statusCounts.forEach((item) => {
      console.log(`   ${item._id}: ${item.count} transactions`);
    });

    console.log("\n🔧 Starting migration...\n");

    // Map old statuses to new consolidated statuses
    const statusMigrations = [
      { from: "draft", to: "pending", description: "Draft → Pending" },
      {
        from: "pending_approval",
        to: "pending",
        description: "Pending Approval → Pending",
      },
      {
        from: "info_requested",
        to: "pending",
        description: "Info Requested → Pending",
      },
      { from: "paid", to: "approved", description: "Paid → Approved" },
    ];

    let totalUpdated = 0;

    for (const migration of statusMigrations) {
      const result = await Transaction.updateMany(
        { status: migration.from },
        { $set: { status: migration.to } },
      );

      if (result.modifiedCount > 0) {
        console.log(
          `✅ ${migration.description}: ${result.modifiedCount} transactions updated`,
        );
        totalUpdated += result.modifiedCount;
      } else {
        console.log(`ℹ️  ${migration.description}: No transactions to update`);
      }
    }

    console.log(
      `\n✅ Migration complete! Total transactions updated: ${totalUpdated}`,
    );

    // Show new distribution
    console.log("\n📊 New Status Distribution:");
    const newStatusCounts = await Transaction.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    newStatusCounts.forEach((item) => {
      console.log(`   ${item._id}: ${item.count} transactions`);
    });

    console.log("\n🎉 Status consolidation completed successfully!");
  } catch (error) {
    console.error("❌ Migration error:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
  }
};

// Run the migration
consolidateStatuses()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
