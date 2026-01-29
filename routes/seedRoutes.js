const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Category = require("../models/Category");
const Balance = require("../models/Balance");

/**
 * @route   POST /api/seed/initialize
 * @desc    Initialize database with default data (ADMIN ONLY - ONE TIME USE)
 * @access  Public (but should be secured in production)
 */
router.post("/initialize", async (req, res) => {
  try {
    // Security check - only allow in development or with secret key
    const secretKey = req.headers["x-seed-secret"];
    if (
      process.env.NODE_ENV === "production" &&
      secretKey !== process.env.SEED_SECRET
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized. Provide correct seed secret in X-Seed-Secret header.",
      });
    }

    // Check if data already exists
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      return res.status(400).json({
        success: false,
        message: `Database already has ${existingUsers} users. Clear database first or skip seeding.`,
      });
    }

    // Create Admin User
    const adminUser = await User.create({
      name: "Admin User",
      email: "poorani372006@gmail.com",
      password: "admin123",
      role: "admin",
      department: "Administration",
      phone: "+1234567890",
      isActive: true,
    });

    // Create Manager User
    const managerUser = await User.create({
      name: "John Manager",
      email: "poorani6380045604@gmail.com",
      password: "manager123",
      role: "manager",
      department: "IT",
      phone: "+1234567892",
      approvalLimit: 50000,
      isActive: true,
    });

    // Create Employee User
    const employeeUser = await User.create({
      name: "Jane Employee",
      email: "241cd030@srcw.ac.in",
      password: "employee123",
      role: "employee",
      department: "IT",
      phone: "+1234567893",
      managerId: managerUser._id,
      isActive: true,
    });

    // Create Categories
    const categories = await Category.insertMany([
      {
        name: "Travel",
        description: "Travel expenses",
        budgetLimit: 100000,
        isActive: true,
      },
      {
        name: "Office Supplies",
        description: "Office supplies and stationery",
        budgetLimit: 50000,
        isActive: true,
      },
      {
        name: "Food & Beverage",
        description: "Meals and refreshments",
        budgetLimit: 30000,
        isActive: true,
      },
      {
        name: "Transportation",
        description: "Local transportation",
        budgetLimit: 25000,
        isActive: true,
      },
      {
        name: "Utilities",
        description: "Electricity, water, internet",
        budgetLimit: 40000,
        isActive: true,
      },
      {
        name: "Maintenance",
        description: "Repairs and maintenance",
        budgetLimit: 60000,
        isActive: true,
      },
      {
        name: "Marketing",
        description: "Marketing and advertising",
        budgetLimit: 80000,
        isActive: true,
      },
      {
        name: "Training",
        description: "Employee training and development",
        budgetLimit: 70000,
        isActive: true,
      },
      {
        name: "Entertainment",
        description: "Client entertainment",
        budgetLimit: 35000,
        isActive: true,
      },
      {
        name: "Miscellaneous",
        description: "Other expenses",
        budgetLimit: 20000,
        isActive: true,
      },
    ]);

    // Create Initial Balance
    await Balance.create({
      amount: 500000,
      lastUpdated: new Date(),
      updatedBy: adminUser._id,
    });

    res.status(200).json({
      success: true,
      message: "Database seeded successfully!",
      data: {
        users: [
          {
            email: "poorani372006@gmail.com",
            password: "admin123",
            role: "admin",
          },
          {
            email: "poorani6380045604@gmail.com",
            password: "manager123",
            role: "manager",
          },
          {
            email: "241cd030@srcw.ac.in",
            password: "employee123",
            role: "employee",
          },
        ],
        categoriesCreated: categories.length,
        initialBalance: 500000,
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/seed/status
 * @desc    Check database seeding status
 * @access  Public
 */
router.get("/status", async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const categoryCount = await Category.countDocuments();
    const balance = await Balance.findOne();

    res.status(200).json({
      success: true,
      data: {
        users: userCount,
        categories: categoryCount,
        balance: balance ? balance.amount : 0,
        isSeeded: userCount > 0 && categoryCount > 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
