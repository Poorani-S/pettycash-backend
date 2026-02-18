const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");

const deleteNonAdminUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected...");

    // Find all non-admin users
    const nonAdminUsers = await User.find({ role: { $ne: "admin" } });
    console.log(`\nFound ${nonAdminUsers.length} non-admin users to delete:`);

    nonAdminUsers.forEach((user) => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    // Delete all non-admin users
    const result = await User.deleteMany({ role: { $ne: "admin" } });
    console.log(
      `\n✅ Successfully deleted ${result.deletedCount} non-admin users`,
    );

    // Show remaining users (should be only admins)
    const remainingUsers = await User.find();
    console.log(`\nRemaining users (${remainingUsers.length}):`);
    remainingUsers.forEach((user) => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

deleteNonAdminUsers();
