import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axios";
import Layout from "../components/Layout";

const Reports = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [lastUsersFetch, setLastUsersFetch] = useState(null);

  // Filter states
  const [reportType, setReportType] = useState("summary");
  const [period, setPeriod] = useState("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  // New user modal states
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserLoading, setNewUserLoading] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "vendor",
    bankDetails: {
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      accountHolderName: "",
    },
  });

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchCategories();
    fetchUsers();

    // Auto-refresh users every 30 seconds for admin users
    const userObj = JSON.parse(userData || "{}");
    if (userObj.role === "admin") {
      const interval = setInterval(() => {
        fetchUsers();
      }, 30000); // Refresh every 30 seconds

      // Also refresh when tab becomes visible (user returns to the tab)
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          fetchUsers();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearInterval(interval);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      };
    }
  }, []);

  // Refresh users when component comes into focus (e.g., returning from User Management)
  useEffect(() => {
    const handleFocus = () => {
      // Only refresh if user is admin and we have a stale users list
      if (user?.role === "admin" && lastUsersFetch) {
        const timeSinceLastFetch = Date.now() - lastUsersFetch.getTime();
        if (timeSinceLastFetch > 10000) {
          // If more than 10 seconds old, refresh
          fetchUsers();
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user?.role, lastUsersFetch]);

  // Listen for user updates from other components (like User Management)
  useEffect(() => {
    const handleUsersUpdated = (event) => {
      if (user?.role === "admin") {
        fetchUsers();
      }
    };

    window.addEventListener("usersUpdated", handleUsersUpdated);
    return () => window.removeEventListener("usersUpdated", handleUsersUpdated);
  }, [user?.role]);

  // Auto-generate report when filters change
  useEffect(() => {
    // Don't generate report until user data is loaded
    if (!user) return;

    // Only generate if not using custom date range, or if custom dates are set
    if (period !== "custom" || (customStartDate && customEndDate)) {
      generateReport();
    }
  }, [
    user,
    reportType,
    period,
    selectedCategory,
    selectedStatus,
    selectedUser,
    customStartDate,
    customEndDate,
  ]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/categories");
      setCategories(response.data.data);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchUsers = async (showLoader = false) => {
    try {
      if (showLoader) setUsersLoading(true);
      const response = await axios.get("/users");
      setUsers(response.data.data || []);
      setLastUsersFetch(new Date());
    } catch (err) {
      console.error("Error fetching users:", err);
      // Optionally show a toast notification for failed refresh
    } finally {
      if (showLoader) setUsersLoading(false);
    }
  };

  const handleUserChange = (e) => {
    const value = e.target.value;
    if (value === "add_new") {
      setShowAddUserModal(true);
    } else {
      setSelectedUser(value);
    }
  };

  const handleAddNewUser = async (e) => {
    e.preventDefault();
    setNewUserLoading(true);
    try {
      const response = await axios.post("/clients", newClient);
      // Refresh users list immediately after adding new user
      await fetchUsers();
      setShowAddUserModal(false);
      // Set the newly added user as selected if response contains user ID
      if (response.data.data && response.data.data._id) {
        setSelectedUser(response.data.data._id);
      }
      // Show success notification
      alert(
        `User "${newClient.name}" has been successfully created and added to the user list!`,
      );

      // Trigger custom event to notify other components about user list changes
      window.dispatchEvent(
        new CustomEvent("usersUpdated", {
          detail: { timestamp: Date.now() },
        }),
      );
      setNewClient({
        name: "",
        email: "",
        phone: "",
        address: "",
        category: "vendor",
        bankDetails: {
          bankName: "",
          accountNumber: "",
          ifscCode: "",
          accountHolderName: "",
        },
      });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add user");
    } finally {
      setNewUserLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);

      let params = {};

      if (period === "custom") {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      } else {
        params.period = period;
      }

      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedUser) params.userId = selectedUser;

      let endpoint = "/reports/summary";
      if (reportType === "category") endpoint = "/reports/by-category";
      if (reportType === "monthly") endpoint = "/reports/monthly-trend";

      const response = await axios.get(endpoint, { params });
      setReportData(response.data.data);
    } catch (err) {
      console.error("Error generating report:", err);
      alert(err.response?.data?.message || "Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setLoading(true);
      let params = {};

      if (period === "custom") {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      } else {
        params.period = period;
      }

      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedUser) params.userId = selectedUser;

      const response = await axios.get("/reports/export/pdf", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `petty-cash-report-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error exporting PDF:", err);
      alert("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);
      let params = {};

      if (period === "custom") {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      } else {
        params.period = period;
      }

      if (selectedCategory) params.category = selectedCategory;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedUser) params.userId = selectedUser;

      const response = await axios.get("/reports/export/excel", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `petty-cash-report-${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error exporting Excel:", err);
      alert("Failed to export Excel");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString("en-IN") || 0}`;
  };

  return (
    <Layout>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#023e8a] via-[#0077b6] to-[#00b4d8] rounded-2xl p-8 mb-8 text-white shadow-xl animate-fadeIn">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">Reports & Analytics</h1>
            <p className="text-white/90 text-sm">
              Generate comprehensive reports with export options
            </p>
          </div>
        </div>
      </div>

      <div>
        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-soft p-8 mb-8 animate-slideInUp">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            <div className="bg-gradient-to-br from-[#023e8a] to-[#0077b6] text-white rounded-xl p-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </div>
            Report Filters
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#0077b6]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6]"
              >
                <option value="summary">📊 Summary Report</option>
                <option value="category">📁 Category-wise Report</option>
                <option value="monthly">📈 Monthly Trend</option>
              </select>
            </div>

            {/* Period */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#0077b6]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Time Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6]"
              >
                <option value="today">📅 Today</option>
                <option value="week">🗓️ This Week</option>
                <option value="month">📆 This Month</option>
                <option value="quarter">🗂️ This Quarter</option>
                <option value="year">📋 This Year</option>
                <option value="custom">⚙️ Custom Range</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#0077b6]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6]"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* User Filter - Only for Admin */}
            {user?.role === "admin" && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-[#0077b6]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    User
                  </div>
                  <div className="flex items-center gap-2">
                    {lastUsersFetch && (
                      <span className="text-xs text-gray-500">
                        Last updated: {lastUsersFetch.toLocaleTimeString()}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => fetchUsers(true)}
                      disabled={usersLoading}
                      className="p-1 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
                      title="Refresh users list"
                    >
                      <svg
                        className={`w-4 h-4 text-[#0077b6] ${usersLoading ? "animate-spin" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                  </div>
                </label>
                <select
                  value={selectedUser}
                  onChange={handleUserChange}
                  disabled={usersLoading}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {usersLoading
                      ? "Loading users..."
                      : `All Users (${users.length} total)`}
                  </option>
                  {!usersLoading &&
                    users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  {!usersLoading && (
                    <option
                      value="add_new"
                      className="font-semibold text-[#0077b6]"
                    >
                      ➕ Create New User
                    </option>
                  )}
                </select>
              </div>
            )}
          </div>

          {/* Custom Date Range */}
          {period === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 p-6 bg-gradient-to-r from-blue-50 to-white rounded-xl border border-blue-100 animate-slideInDown">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Start Date
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  End Date
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300"
                />
              </div>
            </div>
          )}

          {/* Status Filter (only for summary) */}
          {reportType === "summary" && (
            <div className="mt-6">
              <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#0077b6]"
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
                Status Filter
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full md:w-1/3 px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6]"
              >
                <option value="">All Statuses</option>
                <option value="pending">⏳ Pending</option>
                <option value="approved">✅ Approved</option>
                <option value="rejected">❌ Rejected</option>
                <option value="paid">💰 Paid</option>
              </select>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={generateReport}
              disabled={loading}
              className="px-8 py-4 bg-gradient-to-r from-[#023e8a] to-[#0077b6] hover:from-[#0077b6] hover:to-[#00b4d8] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Generate Report
                </>
              )}
            </button>
            <button
              onClick={exportToPDF}
              disabled={loading || !reportData}
              className="px-8 py-4 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              Export PDF
            </button>
            <button
              onClick={exportToExcel}
              disabled={loading || !reportData}
              className="px-8 py-4 bg-gradient-to-r from-purple-300 to-purple-400 hover:from-purple-400 hover:to-purple-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export Excel
            </button>
          </div>
        </div>

        {/* Report Display */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-soft p-16 text-center animate-fadeIn">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#0077b6] border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium text-lg">
              Generating report...
            </p>
            <p className="text-gray-400 text-sm mt-2">
              This may take a few moments
            </p>
          </div>
        )}

        {!loading && reportData && (
          <div className="bg-white rounded-2xl shadow-soft p-8 animate-slideInUp">
            {/* Summary Report */}
            {reportType === "summary" && (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                  <svg
                    className="w-8 h-8 text-[#0077b6]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Summary Report
                </h2>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-l-4 border-[#0077b6] shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-gray-600 font-semibold uppercase tracking-wide mb-2">
                      Total Transactions
                    </p>
                    <p className="text-4xl font-bold text-[#023e8a]">
                      {reportData.summary?.totalTransactions || 0}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-l-4 border-green-500 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-gray-600 font-semibold uppercase tracking-wide mb-2">
                      Approved
                    </p>
                    <p className="text-4xl font-bold text-green-700">
                      {reportData.summary?.approvedCount || 0}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {formatCurrency(reportData.summary?.approvedAmount)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-6 border-l-4 border-yellow-500 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-gray-600 font-semibold uppercase tracking-wide mb-2">
                      Pending
                    </p>
                    <p className="text-4xl font-bold text-yellow-700">
                      {reportData.summary?.pendingCount || 0}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {formatCurrency(reportData.summary?.pendingAmount)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border-l-4 border-red-500 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-sm text-gray-600 font-semibold uppercase tracking-wide mb-2">
                      Rejected
                    </p>
                    <p className="text-4xl font-bold text-red-700">
                      {reportData.summary?.rejectedCount || 0}
                    </p>
                    <p className="text-sm text-gray-600 mt-2">
                      {formatCurrency(reportData.summary?.rejectedAmount)}
                    </p>
                  </div>
                </div>

                {/* Category Breakdown */}
                {reportData.categoryBreakdown &&
                  reportData.categoryBreakdown.length > 0 && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <svg
                          className="w-6 h-6 text-purple-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                          />
                        </svg>
                        Category-wise Breakdown
                      </h3>
                      <div className="overflow-x-auto mb-8 rounded-xl border border-gray-200">
                        <table className="min-w-full">
                          <thead className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white">
                            <tr>
                              <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide">
                                Category
                              </th>
                              <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide">
                                Code
                              </th>
                              <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                                Count
                              </th>
                              <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                                Total Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.categoryBreakdown.map((cat, index) => (
                              <tr
                                key={index}
                                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                              >
                                <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                                  {cat.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                  {cat.code}
                                </td>
                                <td className="px-6 py-4 text-sm text-right text-gray-800 font-semibold">
                                  {cat.count}
                                </td>
                                <td className="px-6 py-4 text-sm text-right font-bold text-[#0077b6]">
                                  {formatCurrency(cat.totalAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                {/* Transaction Details Table - For Admin */}
                {user?.role === "admin" &&
                  reportData.transactions &&
                  reportData.transactions.length > 0 && (
                    <>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2 mt-8">
                        <svg
                          className="w-6 h-6 text-[#0077b6]"
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
                        Transaction Details
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="min-w-full">
                          <thead className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white">
                            <tr>
                              <th className="px-4 py-4 text-left text-sm font-bold uppercase tracking-wide">
                                Date
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-bold uppercase tracking-wide">
                                User
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-bold uppercase tracking-wide">
                                Category
                              </th>
                              <th className="px-4 py-4 text-left text-sm font-bold uppercase tracking-wide">
                                Purpose
                              </th>
                              <th className="px-4 py-4 text-right text-sm font-bold uppercase tracking-wide">
                                Amount
                              </th>
                              <th className="px-4 py-4 text-center text-sm font-bold uppercase tracking-wide">
                                Status
                              </th>
                              <th className="px-4 py-4 text-center text-sm font-bold uppercase tracking-wide">
                                Payment Mode
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.transactions.map((txn, index) => (
                              <tr
                                key={txn._id || index}
                                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 transition-colors`}
                              >
                                <td className="px-4 py-3 text-sm text-gray-800">
                                  {new Date(
                                    txn.transactionDate,
                                  ).toLocaleDateString("en-IN")}
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-800">
                                  {txn.submittedBy?.name ||
                                    txn.payeeClientName ||
                                    "N/A"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {txn.category?.name || "N/A"}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                                  {txn.purpose || "N/A"}
                                </td>
                                <td className="px-4 py-3 text-sm text-right font-bold text-[#0077b6]">
                                  {formatCurrency(
                                    txn.postTaxAmount || txn.amount,
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                                      txn.status === "approved"
                                        ? "bg-green-100 text-green-700"
                                        : txn.status === "rejected"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-yellow-100 text-yellow-700"
                                    }`}
                                  >
                                    {txn.status?.charAt(0).toUpperCase() +
                                      txn.status?.slice(1)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-center text-gray-600 uppercase">
                                  {txn.paymentMethod?.replace("_", " ") ||
                                    "N/A"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
              </>
            )}

            {/* Category Report */}
            {reportType === "category" && reportData.length > 0 && (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                  <svg
                    className="w-8 h-8 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  Category-wise Analysis
                </h2>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide">
                          Category
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                          Transactions
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                          Total Amount
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                          Average
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                          Min/Max
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((cat, index) => (
                        <tr
                          key={index}
                          className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-purple-50 transition-colors`}
                        >
                          <td className="px-6 py-4">
                            <div className="text-sm font-bold text-gray-800">
                              {cat.name}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {cat.code}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-800 font-semibold">
                            {cat.count}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-[#0077b6]">
                            {formatCurrency(cat.totalAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-600 font-medium">
                            {formatCurrency(cat.avgAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-600">
                            {formatCurrency(cat.minAmount)} /{" "}
                            {formatCurrency(cat.maxAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Monthly Trend */}
            {reportType === "monthly" && reportData.months && (
              <>
                <h2 className="text-3xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                    />
                  </svg>
                  Monthly Trend - {reportData.year}
                </h2>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full">
                    <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide">
                          Month
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                          Transactions
                        </th>
                        <th className="px-6 py-4 text-right text-sm font-bold uppercase tracking-wide">
                          Total Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.months.map((month, index) => (
                        <tr
                          key={index}
                          className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-green-50 transition-colors`}
                        >
                          <td className="px-6 py-4 text-sm font-bold text-gray-800">
                            {month.month}
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-800 font-semibold">
                            {month.count}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-[#0077b6]">
                            {formatCurrency(month.totalAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {!loading && !reportData && (
          <div className="bg-white rounded-2xl shadow-soft p-16 text-center animate-fadeIn">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-gray-600 font-semibold text-lg mb-2">
              No Report Generated
            </p>
            <p className="text-gray-400">
              Select filters and click "Generate Report" to view data
            </p>
          </div>
        )}
      </div>

      {/* Add New User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slideInUp">
            <div className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                  Create New User
                </h3>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleAddNewUser} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newClient.name}
                    onChange={(e) =>
                      setNewClient({ ...newClient, name: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    placeholder="Enter name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) =>
                      setNewClient({ ...newClient, email: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    placeholder="Enter email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) =>
                      setNewClient({ ...newClient, phone: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={newClient.category}
                    onChange={(e) =>
                      setNewClient({ ...newClient, category: e.target.value })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                  >
                    <option value="vendor">Vendor</option>
                    <option value="supplier">Supplier</option>
                    <option value="contractor">Contractor</option>
                    <option value="service_provider">Service Provider</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={newClient.address}
                  onChange={(e) =>
                    setNewClient({ ...newClient, address: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                  placeholder="Enter address"
                  rows="2"
                />
              </div>

              {/* Bank Details Section */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-[#0077b6]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Banking Details
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={newClient.bankDetails.bankName}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          bankDetails: {
                            ...newClient.bankDetails,
                            bankName: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="Enter bank name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Account Number
                    </label>
                    <input
                      type="text"
                      value={newClient.bankDetails.accountNumber}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          bankDetails: {
                            ...newClient.bankDetails,
                            accountNumber: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="Enter account number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={newClient.bankDetails.ifscCode}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          bankDetails: {
                            ...newClient.bankDetails,
                            ifscCode: e.target.value.toUpperCase(),
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="Enter IFSC code"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={newClient.bankDetails.accountHolderName}
                      onChange={(e) =>
                        setNewClient({
                          ...newClient,
                          bankDetails: {
                            ...newClient.bankDetails,
                            accountHolderName: e.target.value,
                          },
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="Enter account holder name"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newUserLoading}
                  className="flex-1 bg-gradient-to-r from-[#023e8a] to-[#0077b6] hover:from-[#0077b6] hover:to-[#00b4d8] text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {newUserLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      Create User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Reports;
