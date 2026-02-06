const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");
const Category = require("./models/Category");
const Balance = require("./models/Balance");
const FundTransfer = require("./models/FundTransfer");
const Transaction = require("./models/Transaction");

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randAmount = (min, max) => {
  const value = Math.random() * (max - min) + min;
  return Math.round(value * 100) / 100;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

async function ensureUser({
  name,
  email,
  phone,
  role,
  password,
  department,
  managerId,
}) {
  const existing = await User.findOne({ email });
  if (existing) return existing;

  const user = await User.create({
    name,
    email,
    phone,
    role,
    department,
    managerId: managerId || null,
    password,
    otpEnabled: true,
    isActive: true,
  });

  return user;
}

async function ensureBalance(accountType, currentBalance, updatedBy) {
  let bal = await Balance.findOne({ accountType });
  if (!bal) {
    bal = await Balance.create({
      accountType,
      currentBalance: 0,
      totalReceived: 0,
      totalSpent: 0,
      updatedBy: updatedBy?._id,
    });
  }

  bal.currentBalance = currentBalance;
  bal.lastUpdated = new Date();
  bal.updatedBy = updatedBy?._id;
  await bal.save();
  return bal;
}

async function ensureCategory({
  name,
  code,
  description,
  budgetLimit,
  createdBy,
}) {
  const existing = await Category.findOne({ $or: [{ code }, { name }] });
  if (existing) return existing;

  return await Category.create({
    name,
    code,
    description,
    budgetLimit,
    createdBy: createdBy._id,
    isActive: true,
  });
}

async function createFundTransfer({
  initiatedBy,
  transferType,
  amount,
  purpose,
  notes,
  daysBack,
}) {
  return await FundTransfer.create({
    transferType,
    amount,
    purpose,
    notes,
    initiatedBy: initiatedBy._id,
    transferDate: daysAgo(daysBack),
    status: "completed",
    ...(transferType === "bank"
      ? {
          bankName: pick(["HDFC", "ICICI", "SBI", "Axis"]),
          fromAccount: "XXXX-XXXX-1234",
          toAccount: "PETTY-CASH",
          transactionReference: `NEFT${Date.now()}${randInt(10, 99)}`,
        }
      : {
          recipientName: pick(["Office Cash Box", "Admin"]),
          acknowledgment: "Received",
        }),
  });
}

async function createTransaction({
  category,
  employee,
  manager,
  admin,
  status,
  daysBack,
}) {
  const purposes = [
    "Office stationery purchase",
    "Taxi to client meeting",
    "Team lunch",
    "Internet reimbursement",
    "Printer repair",
    "Training course fee",
    "Courier charges",
  ];

  const payees = [
    "Staples Store",
    "Uber",
    "Local Restaurant",
    "Airtel",
    "Service Center",
    "Training Institute",
    "DTDC",
  ];

  const purpose = pick(purposes);
  const payeeClientName = pick(payees);

  const hasGSTInvoice = Math.random() < 0.5;
  const preTaxAmount = randAmount(200, 5000);
  const taxAmount = hasGSTInvoice
    ? Math.round(preTaxAmount * 0.18 * 100) / 100
    : 0;
  const postTaxAmount = Math.round((preTaxAmount + taxAmount) * 100) / 100;

  const transactionDate = daysAgo(daysBack);
  const invoiceDate = daysAgo(daysBack + randInt(0, 2));
  const paymentDate = daysAgo(Math.max(daysBack - randInt(0, 2), 0));

  // Generate unique transaction number (align with controller format)
  const dateStr = transactionDate.toISOString().slice(0, 10).replace(/-/g, "");
  const countForDay = await Transaction.countDocuments({
    transactionNumber: new RegExp(`^TXN-${dateStr}-`),
  });
  const transactionNumber = `TXN-${dateStr}-${String(countForDay + 1).padStart(4, "0")}`;

  const doc = {
    transactionNumber,
    category: category._id,
    hasGSTInvoice,
    transactionDate,
    invoiceDate,
    payeeClientName,
    purpose,
    currency: "INR",
    exchangeRate: 1,
    preTaxAmount,
    taxAmount,
    postTaxAmount,
    paymentDate,
    paymentMethod: pick(["cash", "upi", "bank_transfer", "card"]),
    requestedBy: employee._id,
    submittedBy: employee._id,
    status,
  };

  if (status === "approved" || status === "paid") {
    doc.approvedBy = manager?._id || admin._id;
    doc.approvedAt = new Date();
  }

  if (status === "rejected") {
    doc.rejectedBy = manager?._id || admin._id;
    doc.rejectedAt = new Date();
    doc.adminComment = pick([
      "Missing invoice",
      "Not within policy",
      "Need more details",
    ]);
  }

  if (status === "paid") {
    doc.paidDate = new Date();
  }

  return await Transaction.create(doc);
}

async function seedDummyData() {
  const shouldClear = process.argv.includes("--clear");
  const txCountArgIndex = process.argv.indexOf("--transactions");
  const txCount =
    txCountArgIndex !== -1 ? Number(process.argv[txCountArgIndex + 1]) : 25;

  if (!process.env.MONGODB_URI) {
    console.error("❌ Missing MONGODB_URI in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ MongoDB connected");

  if (shouldClear) {
    console.log(
      "🧹 Clearing collections (Users/Categories/Balances/FundTransfers/Transactions)...",
    );
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Balance.deleteMany({}),
      FundTransfer.deleteMany({}),
      Transaction.deleteMany({}),
    ]);
  }

  console.log("👤 Ensuring users...");
  const admin = await ensureUser({
    name: "Admin User",
    email: "poorani372006@gmail.com",
    phone: "+911111111111",
    role: "admin",
    password: "admin123",
    department: "Administration",
  });

  const manager = await ensureUser({
    name: "Manager User",
    email: "poorani6380045604@gmail.com",
    phone: "+922222222222",
    role: "manager",
    password: "manager123",
    department: "Operations",
  });

  const employees = [];
  const employeeDefs = [
    {
      name: "Jane Employee",
      email: "241cd030@srcw.ac.in",
      phone: "+933333333333",
    },
    {
      name: "Employee Two",
      email: "employee2@pettycash.com",
      phone: "+944444444444",
    },
    {
      name: "Employee Three",
      email: "employee3@pettycash.com",
      phone: "+955555555555",
    },
  ];

  for (const def of employeeDefs) {
    employees.push(
      await ensureUser({
        ...def,
        role: "employee",
        password: "employee123",
        department: pick(["IT", "Marketing", "Sales"]),
        managerId: manager._id,
      }),
    );
  }

  console.log("🏷️ Ensuring categories...");
  const categories = [];
  const categoryDefs = [
    {
      name: "Office Supplies",
      code: "SUPPLY",
      description: "Stationery and office materials",
      budgetLimit: 5000,
    },
    {
      name: "Travel & Transportation",
      code: "TRAVEL",
      description: "Business travel expenses",
      budgetLimit: 10000,
    },
    {
      name: "Food & Beverages",
      code: "FOOD",
      description: "Meals and refreshments",
      budgetLimit: 3000,
    },
    {
      name: "Maintenance & Repairs",
      code: "MAINT",
      description: "Equipment and facility maintenance",
      budgetLimit: 7000,
    },
    {
      name: "Training & Development",
      code: "TRAIN",
      description: "Training and courses",
      budgetLimit: 8000,
    },
  ];

  for (const c of categoryDefs) {
    categories.push(await ensureCategory({ ...c, createdBy: admin }));
  }

  console.log("💰 Ensuring balances...");
  await ensureBalance("petty_cash_bank", 50000, admin);
  await ensureBalance("petty_cash_physical", 15000, admin);

  console.log("🔁 Creating fund transfers...");
  const existingFT = await FundTransfer.countDocuments();
  if (existingFT === 0) {
    await Promise.all([
      createFundTransfer({
        initiatedBy: admin,
        transferType: "bank",
        amount: 25000,
        purpose: "Top-up petty cash",
        notes: "Initial funding",
        daysBack: 18,
      }),
      createFundTransfer({
        initiatedBy: admin,
        transferType: "cash",
        amount: 8000,
        purpose: "Cash withdrawal",
        notes: "Office cash box",
        daysBack: 10,
      }),
      createFundTransfer({
        initiatedBy: admin,
        transferType: "bank",
        amount: 12000,
        purpose: "Top-up",
        notes: "Monthly allocation",
        daysBack: 4,
      }),
    ]);
  }

  console.log(`🧾 Creating transactions (target: ${txCount})...`);
  const existingTx = await Transaction.countDocuments();
  const toCreate = Math.max(txCount - existingTx, 0);

  const statuses = [
    "pending",
    "pending_approval",
    "approved",
    "rejected",
    "paid",
    "draft",
  ];

  for (let i = 0; i < toCreate; i++) {
    const employee = pick(employees);
    const category = pick(categories);
    const status = pick(statuses);
    const daysBack = randInt(0, 30);

    await createTransaction({
      category,
      employee,
      manager,
      admin,
      status,
      daysBack,
    });
  }

  const finalCounts = await Promise.all([
    User.countDocuments(),
    Category.countDocuments(),
    Balance.countDocuments(),
    FundTransfer.countDocuments(),
    Transaction.countDocuments(),
  ]);

  console.log("✅ Dummy data ready");
  console.log(`Users: ${finalCounts[0]}`);
  console.log(`Categories: ${finalCounts[1]}`);
  console.log(`Balances: ${finalCounts[2]}`);
  console.log(`FundTransfers: ${finalCounts[3]}`);
  console.log(`Transactions: ${finalCounts[4]}`);

  await mongoose.disconnect();
  process.exit(0);
}

seedDummyData().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
