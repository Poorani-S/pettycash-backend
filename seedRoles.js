const mongoose = require("mongoose");
const User = require("./models/User");
const Category = require("./models/Category");
const Balance = require("./models/Balance");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/petty-cash";

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected for seeding with all roles...");

    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Balance.deleteMany({});
    console.log("Cleared existing data");

    // 1. Create System Administrator (CEO/Full Access)
    const admin = await User.create({
      name: "System Administrator",
      email: "poorani372006@gmail.com",
      phone: "+916380045604",
      role: "admin",
      department: "Management",
      approvalLimit: null, // Unlimited approval authority
      otpEnabled: true,
      isActive: true,
    });
    console.log("✅ System Administrator created:", admin.email);

    // 2. Create Employee (Finance)
    const custodian1 = await User.create({
      name: "Poorani - Employee",
      email: "poorani0307@gmail.com",
      phone: "+919207386562",
      role: "employee",
      department: "Finance",
      otpEnabled: true,
      isActive: true,
      createdBy: admin._id,
    });
    console.log("✅ Employee 1 created:", custodian1.email);

    const custodian2 = await User.create({
      name: "Accounts Handler",
      email: "employee2@pettycash.com",
      phone: "+919876543213",
      role: "employee",
      department: "Accounts",
      otpEnabled: true,
      isActive: true,
      createdBy: admin._id,
    });
    console.log("✅ Employee 2 created:", custodian2.email);

    // 3. Create Approver/Manager (Department Level)
    const approver1 = await User.create({
      name: "Operations Manager",
      email: "manager.ops@pettycash.com",
      phone: "+919876543214",
      role: "approver",
      department: "Operations",
      approvalLimit: 50000, // Can approve up to ₹50,000
      otpEnabled: true,
      isActive: true,
      createdBy: admin._id,
    });
    console.log("✅ Approver/Manager 1 created:", approver1.email);

    const approver2 = await User.create({
      name: "Marketing Manager",
      email: "manager.marketing@pettycash.com",
      phone: "+919876543215",
      role: "approver",
      department: "Marketing",
      approvalLimit: 30000, // Can approve up to ₹30,000
      otpEnabled: true,
      isActive: true,
      createdBy: admin._id,
    });
    console.log("✅ Approver/Manager 2 created:", approver2.email);

    // 4. Create Auditor (View-Only Access)
    const auditor = await User.create({
      name: "Internal Auditor",
      email: "auditor@pettycash.com",
      phone: "+919876543216",
      role: "auditor",
      department: "Audit & Compliance",
      otpEnabled: true,
      isActive: true,
      createdBy: admin._id,
    });
    console.log("✅ Auditor created:", auditor.email);

    // Create default categories
    const categories = [
      {
        name: "Travel & Transportation",
        code: "TRV",
        description: "Travel expenses, fuel, taxi, parking",
        icon: "🚗",
        color: "#3B82F6",
        isActive: true,
        createdBy: admin._id,
      },
      {
        name: "Office Supplies",
        code: "OFF",
        description: "Stationery, printing, office equipment",
        icon: "📎",
        color: "#10B981",
        isActive: true,
        createdBy: admin._id,
      },
      {
        name: "Food & Refreshments",
        code: "FOOD",
        description: "Team meals, client entertainment, pantry supplies",
        icon: "🍽️",
        color: "#F59E0B",
        isActive: true,
        createdBy: admin._id,
      },
      {
        name: "Utilities & Services",
        code: "UTIL",
        description: "Internet, electricity, water, maintenance",
        icon: "⚡",
        color: "#8B5CF6",
        isActive: true,
        createdBy: admin._id,
      },
      {
        name: "Marketing & Events",
        code: "MRKT",
        description: "Promotional materials, event expenses",
        icon: "📢",
        color: "#EC4899",
        isActive: true,
        createdBy: admin._id,
      },
      {
        name: "Miscellaneous",
        code: "MISC",
        description: "Other petty cash expenses",
        icon: "📋",
        color: "#6B7280",
        isActive: true,
        createdBy: admin._id,
      },
    ];

    await Category.insertMany(categories);
    console.log("✅ Categories created:", categories.length);

    // Initialize balance accounts for each employee
    await Balance.create({
      accountType: "petty_cash_bank",
      currentBalance: 100000, // ₹1,00,000 initial balance
      totalReceived: 100000,
      totalSpent: 0,
      lastUpdated: new Date(),
    });

    await Balance.create({
      accountType: "petty_cash_physical",
      currentBalance: 50000, // ₹50,000 initial balance
      totalReceived: 50000,
      totalSpent: 0,
      lastUpdated: new Date(),
    });

    console.log("✅ Balance accounts initialized");

    console.log("\n========================================");
    console.log("✅ Database seeded successfully with all roles!");
    console.log("========================================\n");

    console.log("📋 ROLE HIERARCHY & ACCESS LEVELS:\n");

    console.log("1. SYSTEM ADMINISTRATOR (Admin/CEO):");
    console.log("   Email: admin@pettycash.com");
    console.log("   Access: Full system access");
    console.log("   - Set up company parameters & thresholds");
    console.log("   - Manage users (create, edit, disable)");
    console.log("   - Oversee all petty-cash accounts");
    console.log("   - Approve expenses (unlimited authority)");
    console.log("   - View all reports\n");

    console.log("2. EMPLOYEE (FINANCE/ACCOUNTS):");
    console.log("   a) Poorani - Email: poorani0307@gmail.com");
    console.log("   b) Accounts Handler - Email: employee2@pettycash.com");
    console.log("   Access: Manage assigned petty-cash account");
    console.log("   - Receive funds (bank transfer or cash)");
    console.log("   - Manage petty-cash fund");
    console.log("   - Record expenses");
    console.log("   - Upload invoices and payment proofs");
    console.log("   - Submit expenses for approval");
    console.log("   - View balance and account status\n");

    console.log("3. APPROVER/MANAGER:");
    console.log("   a) Operations Manager - Email: manager.ops@pettycash.com");
    console.log("      Approval Limit: ₹50,000");
    console.log(
      "   b) Marketing Manager - Email: manager.marketing@pettycash.com",
    );
    console.log("      Approval Limit: ₹30,000");
    console.log("   Access: Review & approve expenses");
    console.log("   - Review submitted expenses");
    console.log("   - Approve or reject with remarks");
    console.log("   - View department reports");
    console.log("   - Expenses above limit escalate to Admin\n");

    console.log("4. AUDITOR:");
    console.log("   Email: auditor@pettycash.com");
    console.log("   Access: View-only (Read-only access)");
    console.log("   - View all reports");
    console.log("   - View transaction details");
    console.log("   - Cannot modify any data");
    console.log("   - Supports internal/external audits\n");

    console.log("========================================");
    console.log("💱 MULTI-CURRENCY SUPPORT:");
    console.log("   Supported: INR, USD, EUR, GBP, AED, SGD, MYR");
    console.log("========================================\n");

    console.log("🔐 MULTI-LEVEL APPROVAL WORKFLOW:");
    console.log("   Level 1: Department Manager/Approver");
    console.log("   Level 2: Admin/CEO (for amounts exceeding manager limit)");
    console.log("========================================\n");

    console.log(
      "⚠️  Note: OTP will be sent to these emails when you request login",
    );
    console.log(
      "   Make sure to configure EMAIL_USER and EMAIL_PASSWORD in .env",
    );
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
