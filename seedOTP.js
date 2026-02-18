const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Category = require("./models/Category");
const Balance = require("./models/Balance");
require("dotenv").config();

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected for seeding...");

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Balance.deleteMany({});
    console.log("Cleared existing data");

    // Create Admin User
    const adminUser = await User.create({
      name: "Admin User",
      email: "poorani372006@gmail.com",
      phone: "+916380045604",
      role: "admin",
      department: "Administration",
      otpEnabled: true,
      isActive: true,
    });
    console.log("✅ Admin user created:", adminUser.email);

    // Create Employee Users
    const handler1 = await User.create({
      name: "Employee One",
      email: "poorani0307@gmail.com",
      phone: "+919207386562",
      role: "employee",
      department: "Operations",
      otpEnabled: true,
      isActive: true,
      createdBy: adminUser._id,
    });

    const handler2 = await User.create({
      name: "Employee Two",
      email: "handler2@pettycash.com",
      phone: "+916369464510",
      role: "employee",
      department: "Marketing",
      otpEnabled: true,
      isActive: true,
      createdBy: adminUser._id,
    });
    console.log("✅ Employee users created");

    // Create Categories
    const categories = await Category.insertMany([
      {
        name: "Office Supplies",
        code: "OFFICE",
        description: "Stationery, printing, and office materials",
        isActive: true,
        createdBy: adminUser._id,
      },
      {
        name: "Travel",
        code: "TRAVEL",
        description: "Transportation, fuel, and travel expenses",
        isActive: true,
        createdBy: adminUser._id,
      },
      {
        name: "Meals & Entertainment",
        code: "MEALS",
        description: "Client meetings, team lunches",
        isActive: true,
        createdBy: adminUser._id,
      },
      {
        name: "Utilities",
        code: "UTILITY",
        description: "Electricity, water, internet bills",
        isActive: true,
        createdBy: adminUser._id,
      },
      {
        name: "Maintenance",
        code: "MAINT",
        description: "Repairs and maintenance",
        isActive: true,
        createdBy: adminUser._id,
      },
      {
        name: "Miscellaneous",
        code: "MISC",
        description: "Other expenses",
        isActive: true,
        createdBy: adminUser._id,
      },
    ]);
    console.log("✅ Categories created:", categories.length);

    // Initialize Balance Accounts
    const bankBalance = await Balance.create({
      accountType: "petty_cash_bank",
      currentBalance: 0,
      totalReceived: 0,
      totalSpent: 0,
      updatedBy: adminUser._id,
    });

    const cashBalance = await Balance.create({
      accountType: "petty_cash_physical",
      currentBalance: 0,
      totalReceived: 0,
      totalSpent: 0,
      updatedBy: adminUser._id,
    });
    console.log("✅ Balance accounts initialized");

    console.log("\n========================================");
    console.log("✅ Seed data created successfully!");
    console.log("========================================\n");
    console.log("Test Users for OTP Login:");
    console.log("1. Admin:");
    console.log("   Email: poorani372006@gmail.com");
    console.log("   Phone: +91630045604");
    console.log("\n2. Handler 1:");
    console.log("   Email: poorani0307@gmail.com");
    console.log("   Phone: +916380045604");
    console.log("\n3. Handler 2:");
    console.log("   Email: handler2@pettycash.com");
    console.log("   Phone: +919876543212");
    console.log(
      "\n⚠️  Note: OTP will be sent to these emails when you request login",
    );
    console.log(
      "   Make sure to configure EMAIL_USER and EMAIL_PASSWORD in .env",
    );
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
