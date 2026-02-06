const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

let adminToken = null;

async function testAdminAPIs() {
  try {
    console.log("🧪 Testing Admin APIs...\n");

    // Test 1: Admin Login
    console.log("1️⃣ Testing Admin Login...");
    try {
      const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
        email: "poorani372006@gmail.com",
        password: "admin123",
      });
      adminToken = loginRes.data.data.token;
      console.log("✅ Admin login successful");
      console.log(`   Token: ${adminToken.substring(0, 20)}...`);
      console.log(
        `   User: ${loginRes.data.data.name} (${loginRes.data.data.role})\n`,
      );
    } catch (err) {
      console.log(
        "❌ Admin login failed:",
        err.response?.data?.message || err.message,
      );
      return;
    }

    const headers = { Authorization: `Bearer ${adminToken}` };

    // Test 2: Fetch Users (Admin Feature)
    console.log("2️⃣ Testing Fetch Users (Admin)...");
    try {
      const usersRes = await axios.get(`${BASE_URL}/users`, { headers });
      console.log(`✅ Fetched ${usersRes.data.data.length} users`);
      console.log(
        `   Roles: ${usersRes.data.data.map((u) => u.role).join(", ")}\n`,
      );
    } catch (err) {
      console.log(
        "❌ Fetch users failed:",
        err.response?.data?.message || err.message,
        "\n",
      );
    }

    // Test 3: Fetch Categories (Admin Feature)
    console.log("3️⃣ Testing Fetch Categories...");
    try {
      const categoriesRes = await axios.get(`${BASE_URL}/categories`, {
        headers,
      });
      console.log(`✅ Fetched ${categoriesRes.data.data.length} categories`);
      console.log(
        `   Categories: ${categoriesRes.data.data
          .map((c) => c.name)
          .slice(0, 3)
          .join(", ")}\n`,
      );
    } catch (err) {
      console.log(
        "❌ Fetch categories failed:",
        err.response?.data?.message || err.message,
        "\n",
      );
    }

    // Test 4: Fetch Transactions
    console.log("4️⃣ Testing Fetch Transactions...");
    try {
      const transactionsRes = await axios.get(`${BASE_URL}/transactions`, {
        headers,
      });
      console.log(
        `✅ Fetched ${transactionsRes.data.data.length} transactions\n`,
      );
    } catch (err) {
      console.log(
        "❌ Fetch transactions failed:",
        err.response?.data?.message || err.message,
        "\n",
      );
    }

    // Test 5: Fetch Fund Transfers (Admin Feature)
    console.log("5️⃣ Testing Fetch Fund Transfers...");
    try {
      const fundTransfersRes = await axios.get(`${BASE_URL}/fund-transfers`, {
        headers,
      });
      console.log(
        `✅ Fetched ${fundTransfersRes.data.data.length} fund transfers`,
      );
      if (fundTransfersRes.data.data.length > 0) {
        const ft = fundTransfersRes.data.data[0];
        console.log(
          `   Latest: ₹${ft.amount} - ${ft.purpose || ft.notes || "N/A"}\n`,
        );
      } else {
        console.log("   No fund transfers found\n");
      }
    } catch (err) {
      console.log(
        "❌ Fetch fund transfers failed:",
        err.response?.data?.message || err.message,
        "\n",
      );
    }

    // Test 6: Fetch Financial Summary
    console.log("6️⃣ Testing Financial Summary (Reports)...");
    try {
      const summaryRes = await axios.get(
        `${BASE_URL}/reports/financial-summary`,
        { headers },
      );
      console.log("✅ Financial summary fetched");
      const expense = summaryRes.data.data?.expenseTransactions?.summary || {};
      const fund = summaryRes.data.data?.fundTransfers?.overall || {};
      console.log(
        `   Expense: ₹${expense.totalAmount || 0} (${expense.totalTransactions || 0} txns)`,
      );
      console.log(
        `   Funds: ₹${fund.total || 0} (${fund.count || 0} transfers)\n`,
      );
    } catch (err) {
      console.log(
        "❌ Fetch financial summary failed:",
        err.response?.data?.message || err.message,
        "\n",
      );
    }

    // Test 7: Create Category (Admin Only)
    console.log("7️⃣ Testing Create Category (Admin Only)...");
    try {
      const createCatRes = await axios.post(
        `${BASE_URL}/categories`,
        {
          code: "TEST",
          name: "Test Category",
          description: "Testing admin category creation",
        },
        { headers },
      );
      console.log("✅ Category created successfully");
      const catId = createCatRes.data.data._id;
      console.log(`   Category ID: ${catId}\n`);

      // Cleanup: Delete the test category
      await axios.delete(`${BASE_URL}/categories/${catId}`, { headers });
      console.log("   🗑️  Test category cleaned up\n");
    } catch (err) {
      console.log(
        "❌ Create category failed:",
        err.response?.data?.message || err.message,
        "\n",
      );
    }

    console.log("✅ All API tests completed!");
  } catch (error) {
    console.error("❌ Unexpected error:", error.message);
  }
}

testAdminAPIs();
