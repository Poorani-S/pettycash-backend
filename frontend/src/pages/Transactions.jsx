import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axios";
import Layout from "../components/Layout";

const Transactions = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pending, approved, rejected
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = filter !== "all" ? { status: filter } : {};
      const response = await axios.get("/transactions", { params });
      setTransactions(response.data.data);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm("Are you sure you want to approve this transaction?")) {
      return;
    }

    try {
      await axios.patch(`/transactions/${id}/approve`);
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve transaction");
    }
  };

  const handleReject = async (id) => {
    const comment = window.prompt("Enter rejection reason:");
    if (!comment) return;

    try {
      await axios.patch(`/transactions/${id}/reject`, { comment });
      fetchTransactions();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject transaction");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    return badges[status] || "bg-gray-100 text-gray-700";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const filteredTransactions = transactions.filter(
    (transaction) =>
      transaction.payeeClientName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      transaction.purpose?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      transaction.category?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const stats = {
    total: transactions.length,
    pending: transactions.filter((t) => t.status === "pending").length,
    approved: transactions.filter((t) => t.status === "approved").length,
    rejected: transactions.filter((t) => t.status === "rejected").length,
    totalAmount: transactions.reduce(
      (sum, t) => sum + (t.postTaxAmount || 0),
      0,
    ),
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="mb-8 animate-slideInUp">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[#023e8a] to-[#0077b6] bg-clip-text text-transparent mb-2">
              Transaction Management
            </h1>
            <p className="text-gray-600 text-lg">
              View, manage and track all expense transactions
            </p>
          </div>
          <button
            onClick={() => navigate("/transactions/new")}
            className="px-6 py-3 bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white rounded-xl hover:shadow-lg transition-all duration-300 flex items-center gap-2 group shadow-md"
          >
            <svg
              className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300"
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
            <span className="font-semibold">New Expense</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-blue-500">
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-10 h-10 text-blue-500"
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
          </div>
          <p className="text-gray-600 text-sm font-semibold mb-1">
            Total Transactions
          </p>
          <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
        </div>

        <div
          className="bg-white rounded-2xl p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-yellow-500"
          style={{ animationDelay: "50ms" }}
        >
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-10 h-10 text-yellow-500"
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
          <p className="text-gray-600 text-sm font-semibold mb-1">Pending</p>
          <p className="text-3xl font-bold text-gray-800">{stats.pending}</p>
        </div>

        <div
          className="bg-white rounded-2xl p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-green-500"
          style={{ animationDelay: "100ms" }}
        >
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-10 h-10 text-green-500"
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
          <p className="text-gray-600 text-sm font-semibold mb-1">Approved</p>
          <p className="text-3xl font-bold text-gray-800">{stats.approved}</p>
        </div>

        <div
          className="bg-white rounded-2xl p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft border-l-4 border-red-500"
          style={{ animationDelay: "150ms" }}
        >
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-600 text-sm font-semibold mb-1">Rejected</p>
          <p className="text-3xl font-bold text-gray-800">{stats.rejected}</p>
        </div>

        <div
          className="bg-gradient-to-br from-[#023e8a] to-[#0077b6] rounded-2xl p-6 shadow-soft hover:shadow-hover transition-all duration-300 card-hover animate-slideInLeft text-white border-l-4 border-white"
          style={{ animationDelay: "200ms" }}
        >
          <div className="flex items-center justify-between mb-2">
            <svg
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-blue-100 text-sm font-semibold mb-1">
            Total Amount
          </p>
          <p className="text-3xl font-bold">
            ₹{stats.totalAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div
        className="bg-white rounded-2xl shadow-soft p-6 mb-8 animate-slideInUp"
        style={{ animationDelay: "250ms" }}
      >
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {["all", "pending", "approved", "rejected"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                  filter === f
                    ? "bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white shadow-md scale-105"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {f === "all" && (
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
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                )}
                {f === "pending" && (
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {f === "approved" && (
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
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {f === "rejected" && (
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
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-96">
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by payee, purpose, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-soft p-12 text-center animate-fadeIn">
          <div className="w-16 h-16 border-4 border-[#0077b6] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-600 font-semibold mt-4 text-lg">
            Loading transactions...
          </p>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-12 text-center animate-fadeIn">
          <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            No transactions found
          </h3>
          <p className="text-gray-600 mb-6">
            Start by submitting your first expense request
          </p>
          <button
            onClick={() => navigate("/transactions/new")}
            className="px-6 py-3 bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white rounded-xl hover:shadow-lg transition-all duration-300 font-semibold"
          >
            Submit New Expense
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTransactions.map((transaction, index) => (
            <div
              key={transaction._id}
              style={{ animationDelay: `${index * 50}ms` }}
              className="bg-white rounded-2xl shadow-soft p-6 hover:shadow-hover transition-all duration-300 card-hover animate-slideInRight border-l-4 border-transparent hover:border-[#0077b6]"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className="flex items-center gap-2 bg-gradient-to-r from-[#023e8a]/10 to-[#0077b6]/10 px-4 py-2 rounded-xl">
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
                      <span className="font-bold text-[#023e8a]">
                        {transaction.category?.name}
                      </span>
                    </div>
                    <span
                      className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm flex items-center gap-2 ${getStatusBadge(transaction.status)}`}
                    >
                      {transaction.status === "approved" && (
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                      {transaction.status === "pending" && (
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
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                      {transaction.status === "rejected" && (
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      )}
                      {transaction.status.toUpperCase()}
                    </span>
                    {transaction.hasGSTInvoice && (
                      <span className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-100 text-blue-700 flex items-center gap-2">
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
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        GST Invoice
                      </span>
                    )}
                  </div>
                  <p className="text-gray-800 font-semibold mb-2 text-lg">
                    {transaction.purpose}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-2">
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
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      {transaction.payeeClientName}
                    </span>
                    <span className="flex items-center gap-2">
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
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {formatDate(transaction.paymentDate)}
                    </span>
                    <span className="flex items-center gap-2">
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
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                      {transaction.paymentMode}
                    </span>
                  </div>
                </div>
                <div className="text-right lg:text-right">
                  <p className="text-3xl font-bold text-[#023e8a]">
                    ₹{transaction.postTaxAmount.toLocaleString("en-IN")}
                  </p>
                  {transaction.taxAmount > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Tax: ₹{transaction.taxAmount.toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-4 border-t border-gray-100 gap-4">
                <p className="text-sm text-gray-500 flex items-center gap-2">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Submitted by{" "}
                  <span className="font-semibold">
                    {transaction.submittedBy?.name}
                  </span>{" "}
                  on {formatDate(transaction.createdAt)}
                </p>

                <div className="flex items-center gap-3">
                  {user?.role === "admin" &&
                    transaction.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleReject(transaction._id)}
                          className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg"
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprove(transaction._id)}
                          className="px-5 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 shadow-md hover:shadow-lg"
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Approve
                        </button>
                      </>
                    )}
                </div>
              </div>

              {/* Rejection Comment */}
              {transaction.status === "rejected" &&
                transaction.adminComment && (
                  <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-xl animate-slideInUp">
                    <p className="text-sm font-bold text-red-700 mb-1 flex items-center gap-2">
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      Rejection Reason:
                    </p>
                    <p className="text-sm text-red-600">
                      {transaction.adminComment}
                    </p>
                  </div>
                )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
};

export default Transactions;
