import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "../utils/axios";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalExpenses: 0,
    pendingCount: 0,
    approvedCount: 0,
    currentBalance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      navigate("/login");
      return;
    }

    setUser(JSON.parse(userData));
    fetchDashboardData();

    // Listen for transaction updates from other pages
    const handleTransactionUpdate = () => {
      fetchDashboardData();
    };

    window.addEventListener("transactionsUpdated", handleTransactionUpdate);

    return () => {
      window.removeEventListener(
        "transactionsUpdated",
        handleTransactionUpdate,
      );
    };
  }, [navigate]);

  const handleClearAllData = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete ALL transactions and fund transfers? This cannot be undone.",
      )
    )
      return;
    try {
      await axios.delete("/transactions/clear-all");
      setRecentTransactions([]);
      setStats({
        totalExpenses: 0,
        pendingCount: 0,
        approvedCount: 0,
        currentBalance: 0,
      });
      window.dispatchEvent(new Event("transactionsUpdated"));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to clear data");
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [financialRes, balanceRes, transactionsRes, fundTransfersRes] =
        await Promise.all([
          axios.get("/reports/financial-summary").catch(() => ({ data: {} })),
          axios
            .get("/fund-transfers/balance/current")
            .catch(() => ({ data: { data: { currentBalance: 0 } } })),
          axios
            .get("/transactions?limit=10")
            .catch(() => ({ data: { data: [] } })),
          axios
            .get("/fund-transfers?limit=10")
            .catch(() => ({ data: { data: [] } })),
        ]);

      const financial = financialRes.data?.data;
      const expenseSummary = financial?.expenseTransactions?.summary || {};
      const fundOverall = financial?.fundTransfers?.overall || {};

      // Get transactions and fund transfers
      const transactions = transactionsRes.data?.data || [];
      const fundTransfers = fundTransfersRes.data?.data || [];

      const combinedTotal =
        (expenseSummary.totalAmount || 0) + (fundOverall.total || 0);

      const pendingCount = expenseSummary.pendingCount || 0;
      const approvedCount =
        (expenseSummary.approvedCount || 0) + (fundOverall.count || 0);

      setStats({
        totalExpenses: combinedTotal,
        pendingCount,
        approvedCount,
        currentBalance: balanceRes.data.data?.currentBalance || 0,
      });

      // Combine and sort recent transactions
      const normalizedTransactions = transactions.map((tx) => ({
        ...tx,
        kind: "transaction",
        displayDate: tx.transactionDate,
        displayAmount: tx.postTaxAmount || tx.amount,
      }));

      const normalizedFundTransfers = fundTransfers.map((ft) => ({
        _id: ft._id,
        kind: "fund_transfer",
        status: "approved",
        description: ft.purpose || ft.notes || "Fund Transfer",
        category: { name: ft.purpose || "Fund Transfer" },
        displayDate: ft.transferDate,
        displayAmount: ft.amount,
        amount: ft.amount,
        transferType: ft.transferType,
      }));

      // Combine and sort by date
      const combined = [...normalizedTransactions, ...normalizedFundTransfers]
        .sort((a, b) => new Date(b.displayDate) - new Date(a.displayDate))
        .slice(0, 5);

      setRecentTransactions(combined);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#023e8a] via-[#0077b6] to-[#0096c7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-white font-semibold mt-4 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 text-white shadow-2xl animate-slideInUp">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2">
              Welcome back, {user.name}! 👋
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm md:text-base lg:text-lg">
              Here's what's happening with your petty cash today
            </p>
          </div>
          <div className="hidden md:block">
            <svg
              className="w-32 h-32 text-white/20"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Total Expenses */}
        <div
          className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-blue-500"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="bg-gradient-to-br from-[#0077b6] to-[#00b4d8] rounded-xl p-2 sm:p-3">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="text-blue-500 text-xs sm:text-sm font-bold bg-blue-50 px-2 sm:px-3 py-1 rounded-full">
              Recent
            </span>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm font-semibold mb-1">
            Total Expenses
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">
            ₹{stats.totalExpenses.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500 mt-1 sm:mt-2">
            📊 Last 5 transactions
          </p>
        </div>

        {/* Pending Approval */}
        <div
          className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-yellow-500"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-2 sm:p-3">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-yellow-600 text-xs sm:text-sm font-bold bg-yellow-50 px-2 sm:px-3 py-1 rounded-full">
              Awaiting
            </span>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm font-semibold mb-1">
            Pending Approval
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">
            {stats.pendingCount}
          </p>
          <p className="text-xs text-gray-500 mt-1 sm:mt-2">
            ⏳ Needs attention
          </p>
        </div>

        {/* Approved */}
        <div
          className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-purple-500"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-2 sm:p-3">
              <svg
                className="w-6 h-6 sm:w-8 sm:h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="text-purple-600 text-xs sm:text-sm font-bold bg-purple-50 px-2 sm:px-3 py-1 rounded-full">
              Success
            </span>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm font-semibold mb-1">
            Approved Requests
          </p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-800">
            {stats.approvedCount}
          </p>
          <p className="text-xs text-gray-500 mt-1 sm:mt-2">✅ Completed</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div
        className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-soft animate-slideInUp"
        style={{ animationDelay: "400ms" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <svg
                className="w-6 h-6 sm:w-7 sm:h-7 text-[#0077b6]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Recent Activity
            </h2>
            <p className="text-gray-600 text-xs sm:text-sm mt-1">
              Your latest transactions at a glance
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.role === "admin" && (
              <button
                onClick={handleClearAllData}
                className="px-3 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg sm:rounded-xl transition-all duration-300 flex items-center gap-1 sm:gap-2 text-sm sm:text-base font-semibold"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                <span className="hidden sm:inline">Clear All</span>
              </button>
            )}
            <button
              onClick={() => navigate("/transactions")}
              className="px-3 sm:px-4 py-2 bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white rounded-lg sm:rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-1 sm:gap-2 group text-sm sm:text-base"
            >
              <span className="font-semibold hidden sm:inline">View All</span>
              <span className="font-semibold sm:hidden">All</span>
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-[#0077b6] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading transactions...</p>
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold">No transactions yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Start by submitting your first expense
            </p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {recentTransactions.map((transaction, index) => (
              <div
                key={transaction._id}
                style={{ animationDelay: `${index * 50}ms` }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-[#0077b6] transition-all duration-300 animate-slideInRight gap-3 sm:gap-4"
              >
                <div className="flex items-center gap-3 sm:gap-4 flex-1">
                  <div
                    className={`rounded-xl p-2 sm:p-3 ${
                      transaction.kind === "fund_transfer"
                        ? transaction.transferType === "bank"
                          ? "bg-green-100 text-green-600"
                          : "bg-yellow-100 text-yellow-600"
                        : transaction.status === "approved"
                          ? "bg-green-100 text-green-600"
                          : transaction.status === "pending"
                            ? "bg-yellow-100 text-yellow-600"
                            : "bg-red-100 text-red-600"
                    }`}
                  >
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm sm:text-base truncate">
                      {transaction.description || "Expense"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {transaction.kind === "fund_transfer"
                        ? `Fund Transfer (${transaction.transferType || ""})`
                        : transaction.category?.name || "General"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(
                        transaction.displayDate || transaction.transactionDate,
                      ).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                  <p className="text-lg sm:text-xl font-bold text-gray-800">
                    ₹
                    {(
                      transaction.displayAmount ||
                      transaction.postTaxAmount ||
                      transaction.amount ||
                      0
                    ).toLocaleString()}
                  </p>
                  <span
                    className={`inline-block px-2 sm:px-3 py-1 rounded-full text-xs font-bold ${
                      transaction.kind === "fund_transfer"
                        ? transaction.transferType === "bank"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                        : transaction.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : transaction.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                    }`}
                  >
                    {transaction.kind === "fund_transfer"
                      ? (transaction.transferType || "transfer").toUpperCase()
                      : transaction.status?.toUpperCase() || "PENDING"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export default Dashboard;
