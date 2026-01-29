const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("./models/User");
const Category = require("./models/Category");
const Transaction = require("./models/Transaction");

// Load env vars
dotenv.config();

// Connect to DB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected..."))
  .catch((err) => {
    console.error("MongoDB Connection Error:", err);
    process.exit(1);
  });

const seedData = async () => {
  try {
    // Clear existing data
    await User.deleteMany();
    await Category.deleteMany();
    await Transaction.deleteMany();

    console.log("Data cleared...");

    // Create users
    const admin = await User.create({
      name: "Admin User",
      email: "poorani372006@gmail.com",
      password: "admin123",
      role: "admin",
      department: "Administration",
      phone: "+1234567890",
    });

    const manager = await User.create({
      name: "John Manager",
      email: "poorani6380045604@gmail.com",
      password: "manager123",
      role: "manager",
      department: "IT",
      phone: "+1234567892",
    });

    const employee = await User.create({
      name: "Jane Employee",
      email: "241cd030@srcw.ac.in",
      password: "employee123",
      role: "employee",
      department: "IT",
      phone: "+1234567893",
      managerId: manager._id,
    });

    console.log("Users created...");

    // Create categories
    const categories = await Category.create([
      {
        name: "Office Supplies",
        code: "SUPPLY",
        description: "Stationery, paper, and office materials",
        budgetLimit: 5000,
        createdBy: admin._id,
      },
      {
        name: "Travel & Transportation",
        code: "TRAVEL",
        description: "Business travel expenses",
        budgetLimit: 10000,
        createdBy: admin._id,
      },
      {
        name: "Food & Beverages",
        code: "FOOD",
        description: "Team meals and refreshments",
        budgetLimit: 3000,
        createdBy: admin._id,
      },
      {
        name: "Maintenance & Repairs",
        code: "MAINT",
        description: "Equipment and facility maintenance",
        budgetLimit: 7000,
        createdBy: admin._id,
      },
      {
        name: "Training & Development",
        code: "TRAIN",
        description: "Employee training and courses",
        budgetLimit: 8000,
        createdBy: admin._id,
      },
    ]);

    console.log("Categories created...");

    // Create sample transactions - Commented out due to required fields
    // await Transaction.create([
    //   {
    //     title: "Office Stationery Purchase",
    //     description: "Purchased pens, notebooks, and folders for the team",
    //     amount: 150.5,
    //     category: categories[0]._id,
    //     transactionDate: new Date(),
    //     paymentMethod: "cash",
    //     vendor: "Office Depot",
    //     receiptNumber: "REC-001",
    //     requestedBy: employee._id,
    //     status: "draft",
    //   },
    //   {
    //     title: "Client Meeting Lunch",
    //     description: "Lunch with potential clients at downtown restaurant",
    //     amount: 85.0,
    //     category: categories[2]._id,
    //     transactionDate: new Date(),
    //     paymentMethod: "card",
    //     vendor: "Downtown Bistro",
    //     receiptNumber: "REC-002",
    //     requestedBy: employee._id,
    //     status: "pending_manager",
    //     approvals: [
    //       {
    //         approver: manager._id,
    //         role: "manager",
    //         status: "pending",
    //       },
    //     ],
    //   },
    // ]);

    // console.log("Sample transactions created...");

    console.log("\n=================================");
    console.log("SEED DATA CREATED SUCCESSFULLY!");
    console.log("=================================\n");
    console.log("Test Credentials:");
    console.log("\n1. Admin:");
    console.log("   Email: poorani372006@gmail.com");
    console.log("   Password: admin123");
    console.log("\n2. Manager:");
    console.log("   Email: poorani6380045604@gmail.com");
    console.log("   Password: manager123");
    console.log("\n3. Employee:");
    console.log("   Email: 241cd030@srcw.ac.in");
    console.log("   Password: employee123");
    console.log("\n=================================\n");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding data:", error);
    process.exit(1);
  }
};

seedData();
