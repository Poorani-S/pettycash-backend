const mongoose = require("mongoose");
const User = require("../models/User");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/petty-cash";

const migrateCustodianToEmployee = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected for migration...");

    // Find all users with custodian or handler role
    const custodiansAndHandlers = await User.find({
      role: { $in: ["custodian", "handler"] },
    });

    console.log(
      `Found ${custodiansAndHandlers.length} users with custodian/handler role`,
    );

    if (custodiansAndHandlers.length === 0) {
      console.log("No users to migrate.");
      await mongoose.connection.close();
      return;
    }

    // Update all custodian and handler roles to employee
    const result = await User.updateMany(
      { role: { $in: ["custodian", "handler"] } },
      { $set: { role: "employee" } },
    );

    console.log("\n========================================");
    console.log("✅ Migration completed successfully!");
    console.log("========================================");
    console.log(`Updated ${result.modifiedCount} user(s) to employee role`);
    console.log("\nUpdated users:");

    // Show the updated users
    for (const user of custodiansAndHandlers) {
      console.log(`  - ${user.name} (${user.email}) → Role: employee`);
    }

    await mongoose.connection.close();
    console.log("\nDatabase connection closed.");
  } catch (error) {
    console.error("Migration error:", error);
    process.exit(1);
  }
};

// Run the migration
migrateCustodianToEmployee();
