import { useState, useEffect } from "react";
import axios from "../utils/axios";
import Layout from "../components/Layout";
import { toast } from "react-toastify";

const FundTransfer = () => {
  const [transferType, setTransferType] = useState("bank");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [purpose, setPurpose] = useState("");
  const [transferDate, setTransferDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [currentBalance, setCurrentBalance] = useState(0);
  const [fundTransfers, setFundTransfers] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stats, setStats] = useState(null);
  const [userBankDetails, setUserBankDetails] = useState(null);

  // Client/User states
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedClientDetails, setSelectedClientDetails] = useState(null);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [newClientLoading, setNewClientLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    action: null,
    message: "",
  });
  const [deleteClientModal, setDeleteClientModal] = useState({
    show: false,
    clientId: null,
    clientName: "",
  });
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
    fetchCurrentBalance();
    fetchAllTransactions();
    fetchStats();
    loadUserBankDetails();
    fetchClients();
  }, []);

  const loadUserBankDetails = () => {
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.bankDetails) {
          setUserBankDetails(user.bankDetails);
          // Pre-fill bank name from user details
          if (user.bankDetails.bankName) {
            setBankName(user.bankDetails.bankName);
          }
        }
      }
    } catch (err) {
      console.error("Error loading user bank details:", err);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get("/clients");
      setClients(response.data.data || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
    }
  };

  const handleClientChange = async (e) => {
    const value = e.target.value;
    if (value === "add_new") {
      // Refetch clients to get latest data before showing modal
      await fetchClients();
      setShowAddClientModal(true);
    } else {
      setSelectedClient(value);
      // Set selected client details and pre-fill bank details
      if (value) {
        const client = clients.find((c) => c._id === value);
        setSelectedClientDetails(client || null);
        if (client?.bankDetails) {
          setBankName(client.bankDetails.bankName || "");
          setAccountNumber(client.bankDetails.accountNumber || "");
        } else {
          setBankName("");
          setAccountNumber("");
        }
      } else {
        setSelectedClientDetails(null);
        setBankName("");
        setAccountNumber("");
      }
    }
  };

  const handleAddClient = async (e) => {
    e.preventDefault();
    setNewClientLoading(true);
    try {
      const response = await axios.post("/clients", newClient);
      const addedClient = response.data.data;
      // Refetch to ensure we have the latest client list
      await fetchClients();
      setSelectedClient(addedClient._id);
      setSelectedClientDetails(addedClient);
      setShowAddClientModal(false);
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
      // Pre-fill bank details
      if (addedClient.bankDetails) {
        setBankName(addedClient.bankDetails.bankName || "");
        setAccountNumber(addedClient.bankDetails.accountNumber || "");
      }
      toast.success(`Client "${addedClient.name}" added successfully!`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add client");
    } finally {
      setNewClientLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    try {
      const response = await axios.delete(
        `/clients/${deleteClientModal.clientId}`,
      );
      if (response.data.success) {
        // Refetch to ensure we have the latest client list
        await fetchClients();
        if (selectedClient === deleteClientModal.clientId) {
          setSelectedClient("");
          setSelectedClientDetails(null);
          setBankName("");
          setAccountNumber("");
        }
        toast.success(
          `User "${deleteClientModal.clientName}" deleted successfully!`,
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    } finally {
      setDeleteClientModal({ show: false, clientId: null, clientName: "" });
    }
  };

  const fetchCurrentBalance = async () => {
    try {
      const response = await axios.get("/fund-transfers/balance/current");
      setCurrentBalance(response.data.data.currentBalance);
    } catch (err) {
      console.error("Error fetching balance:", err);
    }
  };

  const fetchFundTransfers = async () => {
    try {
      const response = await axios.get("/fund-transfers?limit=20");
      console.log("Fund Transfers API Response:", response.data);
      setFundTransfers(response.data.data || []);
    } catch (err) {
      console.error("Error fetching fund transfers:", err);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      // Fetch both fund transfers and expense transactions with error handling
      let fundTransfersData = [];
      let expenseTransactionsData = [];

      try {
        const fundTransfersRes = await axios.get("/fund-transfers?limit=50");
        fundTransfersData = (fundTransfersRes.data.data || []).map((ft) => ({
          ...ft,
          transactionType: "fund_transfer",
          displayDate: ft.transferDate,
          displayAmount: ft.amount,
          isCredit: true,
        }));
        setFundTransfers(fundTransfersRes.data.data || []);
      } catch (err) {
        console.error("Error fetching fund transfers:", err);
      }

      try {
        const expenseTransactionsRes = await axios.get(
          "/transactions?limit=50",
        );
        expenseTransactionsData = (expenseTransactionsRes.data.data || []).map(
          (et) => ({
            ...et,
            transactionType: "expense",
            displayDate: et.date || et.createdAt,
            displayAmount: et.amount,
            isCredit: false,
          }),
        );
      } catch (err) {
        console.error("Error fetching expense transactions:", err);
      }

      // Combine and sort by date (newest first)
      const combined = [...fundTransfersData, ...expenseTransactionsData].sort(
        (a, b) => new Date(b.displayDate) - new Date(a.displayDate),
      );

      setAllTransactions(combined);
    } catch (err) {
      console.error("Error fetching all transactions:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get("/fund-transfers/stats/summary");
      setStats(response.data.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleClearHistory = async () => {
    setConfirmModal({
      show: true,
      action: "clearHistory",
      message:
        "Are you sure you want to clear all fund transfer history? This action cannot be undone.",
    });
  };

  const executeClearHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.delete("/fund-transfers/clear-history");
      toast.success(
        `${response.data.deletedCount} fund transfer record(s) cleared successfully!`,
      );
      setAllTransactions([]);
      fetchStats(); // Refresh stats
    } catch (err) {
      console.error("Error clearing history:", err);
      toast.error(err.response?.data?.message || "Failed to clear history");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = {
        transferType,
        amount: parseFloat(amount),
        transferDate,
        remarks,
        purpose,
        clientId: selectedClient || undefined,
      };

      if (transferType === "bank") {
        data.bankName = bankName;
        data.accountNumber = accountNumber;
        data.transactionId = transactionId;
      }

      const response = await axios.post("/fund-transfers", data);

      setSuccess(
        `Funds added successfully! New balance: ₹${response.data.balance.toLocaleString()}`,
      );
      setCurrentBalance(response.data.balance);

      // Dispatch event to notify other components about the update
      window.dispatchEvent(
        new CustomEvent("transactionsUpdated", {
          detail: { action: "fundTransferCreated" },
        }),
      );

      // Reset form - keep bank name pre-filled from user profile
      setAmount("");
      setAccountNumber("");
      setTransactionId("");
      setRemarks("");
      setPurpose("");
      setSelectedClient("");
      setSelectedClientDetails(null);
      setTransferDate(new Date().toISOString().split("T")[0]);
      // Keep bankName from user profile
      if (userBankDetails?.bankName) {
        setBankName(userBankDetails.bankName);
      } else {
        setBankName("");
      }

      // Refresh data
      fetchAllTransactions();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add funds");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Layout>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#023e8a] via-[#0077b6] to-[#00b4d8] rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 text-white shadow-xl animate-fadeIn">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12"
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
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">
              Fund Transfer Management
            </h1>
            <p className="text-white/90 text-xs sm:text-sm">
              Add funds to petty cash via Bank Transfer or Cash Disbursement
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-soft hover:shadow-hover transition-all duration-300 border-l-4 border-purple-500 animate-slideInLeft card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-xs sm:text-sm font-semibold uppercase tracking-wide">
                  Total Expense
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-[#023e8a] mt-1 sm:mt-2">
                  ₹{stats.overall.total.toLocaleString("en-IN")}
                </p>
                <p className="text-gray-500 text-xs sm:text-sm mt-1 flex items-center gap-1">
                  <svg
                    className="w-3 h-3 sm:w-4 sm:h-4"
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
                  {stats.overall.count} transfers
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-purple-600"
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
            </div>
          </div>
          {stats.byType.map((type, index) => (
            <div
              key={type._id}
              className={`bg-white rounded-2xl p-6 shadow-soft hover:shadow-hover transition-all duration-300 border-l-4 ${
                type._id === "Bank Transfer"
                  ? "border-blue-500"
                  : "border-green-500"
              } animate-slideInLeft card-hover`}
              style={{ animationDelay: `${(index + 1) * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold uppercase tracking-wide">
                    {type._id === "cash" || type._id === "Cash"
                      ? "Amount Spend"
                      : type._id}
                  </p>
                  <p className="text-3xl font-bold text-[#023e8a] mt-2">
                    ₹{type.totalAmount.toLocaleString("en-IN")}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {type.count} transfers · Avg: ₹
                    {Math.round(type.avgAmount).toLocaleString("en-IN")}
                  </p>
                </div>
                <div
                  className={`bg-gradient-to-br ${
                    type._id === "Bank Transfer"
                      ? "from-blue-100 to-blue-200"
                      : "from-green-100 to-green-200"
                  } rounded-2xl p-4`}
                >
                  <svg
                    className={`w-10 h-10 ${type._id === "Bank Transfer" ? "text-blue-600" : "text-green-600"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {type._id === "Bank Transfer" ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* Add Funds Form */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-4 sm:p-6 md:p-8 animate-slideInLeft">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <div className="bg-gradient-to-br from-[#023e8a] to-[#0077b6] text-white rounded-xl p-1.5 sm:p-2">
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            Add Funds
          </h2>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3 animate-slideInRight">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3 animate-slideInRight">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
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
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User/Client Selection */}
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Select User *
              </label>
              <select
                value={selectedClient}
                onChange={handleClientChange}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6]"
                required
              >
                <option value="">-- Select User --</option>
                {clients.map((client) => (
                  <option key={client._id} value={client._id}>
                    {client.name}{" "}
                    {client.bankDetails?.bankName
                      ? `(${client.bankDetails.bankName})`
                      : ""}
                  </option>
                ))}
                <option
                  value="add_new"
                  className="font-semibold text-[#0077b6]"
                >
                  ➕ Add New User
                </option>
              </select>

              {selectedClient && selectedClient !== "add_new" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    const client = clients.find(
                      (c) => c._id === selectedClient,
                    );
                    setDeleteClientModal({
                      show: true,
                      clientId: selectedClient,
                      clientName: client?.name || "",
                    });
                  }}
                  className="mt-3 w-full px-4 py-3 bg-red-500 text-white hover:bg-red-600 rounded-xl transition-all font-bold flex items-center justify-center gap-2"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  Delete Selected User
                </button>
              )}
            </div>

            {/* Transfer Type */}
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
                Payment Method *
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setTransferType("bank")}
                  className={`py-4 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    transferType === "bank"
                      ? "bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white shadow-lg transform scale-105"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105"
                  }`}
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
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  Bank Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setTransferType("cash")}
                  className={`py-4 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    transferType === "cash"
                      ? "bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white shadow-lg transform scale-105"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105"
                  }`}
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
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Cash
                </button>
              </div>
            </div>

            {/* Amount */}
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Amount (₹) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 text-lg font-semibold hover:border-[#0077b6]"
                placeholder="0.00"
                required
                min="1"
                step="0.01"
              />
            </div>

            {/* Purpose/Need of Amount */}
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
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Purpose / Need of Amount *
              </label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 font-medium hover:border-[#0077b6]"
                placeholder="e.g., Tools, Office Supplies, Travel, etc."
                required
              />
            </div>

            {/* Transfer Date */}
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
                Transfer Date *
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6]"
                required
              />
            </div>

            {/* Bank Transfer Fields */}
            {transferType === "bank" && (
              <div className="space-y-4 p-5 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                  Bank Details
                  {selectedClientDetails?.bankDetails && (
                    <span className="text-xs font-normal text-green-600 ml-2">
                      ✓ Auto-filled from selected user
                    </span>
                  )}
                </h3>

                {/* Selected User's Bank Info (Read-only) */}
                {selectedClientDetails?.bankDetails ? (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-white rounded-lg border-2 border-green-200">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Bank Name</p>
                      <p className="font-semibold text-gray-800">
                        {selectedClientDetails.bankDetails.bankName ||
                          "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Account Number
                      </p>
                      <p className="font-semibold text-gray-800">
                        {selectedClientDetails.bankDetails.accountNumber ||
                          "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">IFSC Code</p>
                      <p className="font-semibold text-gray-800">
                        {selectedClientDetails.bankDetails.ifscCode ||
                          "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">
                        Account Holder
                      </p>
                      <p className="font-semibold text-gray-800">
                        {selectedClientDetails.bankDetails.accountHolderName ||
                          selectedClientDetails.name ||
                          "Not set"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-yellow-700 text-sm">
                    <p className="flex items-center gap-2">
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
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      {selectedClient
                        ? "Selected user has no bank details. Please update their profile."
                        : "Please select a user to view bank details."}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Transaction ID / Reference *
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 bg-white"
                    placeholder="Enter transaction ID or reference number"
                    required
                  />
                </div>
              </div>
            )}

            {/* Remarks */}
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
                Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6]"
                placeholder="Add any additional notes..."
                rows="3"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#023e8a] to-[#0077b6] hover:from-[#0077b6] hover:to-[#00b4d8] text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Adding Funds...
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
                  Add Funds
                </>
              )}
            </button>
          </form>
        </div>

        {/* Recent Transactions List */}
        <div className="bg-white rounded-2xl shadow-soft p-8 animate-slideInRight">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-2">
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
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              Recent Transactions
            </h2>

            {allTransactions.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold text-sm"
                title="Clear all fund transfer history"
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
                Clear History
              </button>
            )}
          </div>

          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
            {allTransactions.length === 0 ? (
              <div className="text-center py-16">
                <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
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
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No transactions yet</p>
                <p className="text-gray-400 text-sm mt-1">
                  Your transactions will appear here
                </p>
              </div>
            ) : (
              allTransactions.map((transaction, index) => (
                <div
                  key={transaction._id}
                  className={`border-2 rounded-xl p-5 hover:shadow-lg transition-all duration-300 card-hover animate-slideInUp ${
                    transaction.transactionType === "fund_transfer"
                      ? "border-green-100 hover:border-green-400"
                      : "border-red-100 hover:border-red-400"
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Header: Type Badge, Description & Amount */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-3 ${
                          transaction.transactionType === "fund_transfer"
                            ? "bg-gradient-to-br from-green-100 to-green-200"
                            : "bg-gradient-to-br from-red-100 to-red-200"
                        }`}
                      >
                        {transaction.transactionType === "fund_transfer" ? (
                          <svg
                            className="w-6 h-6 text-green-600"
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
                        ) : (
                          <svg
                            className="w-6 h-6 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 12H4"
                            />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-lg">
                          {transaction.transactionType === "fund_transfer"
                            ? transaction.recipientId?.name || "Fund Added"
                            : transaction.description ||
                              transaction.category?.name ||
                              "Expense"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(transaction.displayDate)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-2xl font-bold ${
                        transaction.transactionType === "fund_transfer"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {transaction.transactionType === "fund_transfer"
                        ? "+"
                        : "-"}
                      ₹
                      {(
                        transaction.displayAmount ||
                        transaction.amount ||
                        0
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>

                  {/* Transaction Type & Payment Method Badges */}
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
                        transaction.transactionType === "fund_transfer"
                          ? "bg-gradient-to-r from-green-100 to-green-200 text-green-700"
                          : "bg-gradient-to-r from-red-100 to-red-200 text-red-700"
                      }`}
                    >
                      {transaction.transactionType === "fund_transfer"
                        ? "Fund Transfer"
                        : "Expense"}
                    </span>

                    {transaction.transactionType === "fund_transfer" && (
                      <span
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
                          transaction.transferType === "Bank Transfer" ||
                          transaction.transferType === "bank"
                            ? "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700"
                            : "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700"
                        }`}
                      >
                        {transaction.transferType === "Bank Transfer" ||
                        transaction.transferType === "bank"
                          ? "Bank Transfer"
                          : "Cash"}
                      </span>
                    )}

                    {transaction.transactionType === "expense" &&
                      transaction.category && (
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700">
                          {transaction.category?.name || "Uncategorized"}
                        </span>
                      )}

                    {transaction.transactionType === "expense" &&
                      transaction.status && (
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
                            transaction.status === "approved" ||
                            transaction.status === "paid"
                              ? "bg-gradient-to-r from-green-100 to-green-200 text-green-700"
                              : transaction.status === "pending"
                                ? "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-700"
                                : transaction.status === "rejected"
                                  ? "bg-gradient-to-r from-red-100 to-red-200 text-red-700"
                                  : "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700"
                          }`}
                        >
                          {transaction.status.charAt(0).toUpperCase() +
                            transaction.status.slice(1)}
                        </span>
                      )}
                  </div>

                  {/* Purpose/Description */}
                  {(transaction.purpose || transaction.notes) && (
                    <div className="bg-purple-50 rounded-xl p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <svg
                          className="w-5 h-5 text-purple-600 mt-0.5"
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
                        <div>
                          <span className="text-xs font-semibold text-purple-700 block">
                            {transaction.transactionType === "fund_transfer"
                              ? "Purpose"
                              : "Notes"}
                          </span>
                          <span className="text-sm text-purple-800">
                            {transaction.purpose || transaction.notes}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank Details for Bank Transfer */}
                  {transaction.transactionType === "fund_transfer" &&
                    (transaction.transferType === "Bank Transfer" ||
                      transaction.transferType === "bank") &&
                    (transaction.bankName ||
                      transaction.transactionReference) && (
                      <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 space-y-1 mb-3">
                        {transaction.bankName && (
                          <p className="flex items-center gap-2">
                            <span className="font-semibold">Bank:</span>{" "}
                            {transaction.bankName}
                          </p>
                        )}
                        {transaction.transactionReference && (
                          <p className="flex items-center gap-2">
                            <span className="font-semibold">Txn ID:</span>{" "}
                            {transaction.transactionReference}
                          </p>
                        )}
                      </div>
                    )}

                  {/* Footer: Added By */}
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                    <p className="text-xs text-gray-500">
                      {transaction.transactionType === "fund_transfer"
                        ? "Added"
                        : "Submitted"}{" "}
                      by:{" "}
                      <span className="font-medium text-gray-700">
                        {transaction.addedBy?.name ||
                          transaction.initiatedBy?.name ||
                          transaction.submittedBy?.name ||
                          transaction.user?.name ||
                          "Unknown"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(transaction.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add New User Modal */}
      {showAddClientModal && (
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
                  Add New User
                </h3>
                <button
                  onClick={() => setShowAddClientModal(false)}
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

            <form onSubmit={handleAddClient} className="p-6 space-y-6">
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
                  onClick={() => setShowAddClientModal(false)}
                  className="flex-1 py-3 px-6 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={newClientLoading}
                  className="flex-1 bg-gradient-to-r from-[#023e8a] to-[#0077b6] hover:from-[#0077b6] hover:to-[#00b4d8] text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {newClientLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Adding...
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
                      Add User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slideInUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
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
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Confirm Action
              </h3>
            </div>
            <p className="text-gray-700 mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setConfirmModal({ show: false, action: null, message: "" })
                }
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const { action } = confirmModal;
                  setConfirmModal({ show: false, action: null, message: "" });
                  if (action === "clearHistory") executeClearHistory();
                }}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Client Confirmation Modal */}
      {deleteClientModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-slideInUp">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
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
              </div>
              <h3 className="text-xl font-bold text-gray-900">Delete User?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>"{deleteClientModal.clientName}"</strong>? This action
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setDeleteClientModal({
                    show: false,
                    clientId: null,
                    clientName: "",
                  })
                }
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default FundTransfer;
