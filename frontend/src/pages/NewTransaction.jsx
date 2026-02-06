import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axios";
import Layout from "../components/Layout";
import CameraCapture from "../components/CameraCapture";
import { toast } from "react-toastify";

const NewTransaction = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [userBankDetails, setUserBankDetails] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    clientId: null,
    clientName: "",
  });

  const [formData, setFormData] = useState({
    category: "",
    hasGSTInvoice: false,
    invoiceDate: new Date().toISOString().split("T")[0],
    payeeClientName: "",
    clientId: "",
    purpose: "",
    preTaxAmount: "",
    taxAmount: "",
    postTaxAmount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "cash",
    transactionId: "",
    accountNumber: "",
  });

  const [newClient, setNewClient] = useState({
    name: "",
    gstNumber: "",
    email: "",
    phone: "",
    supplyType: "",
    category: "vendor",
    address: "",
  });

  const [invoiceFile, setInvoiceFile] = useState(null);
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [useCamera, setUseCamera] = useState({
    invoice: false,
    payment: false,
  });

  useEffect(() => {
    fetchCategories();
    fetchClients();
    fetchUserBankDetails();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/categories");
      setCategories(response.data.data);
    } catch (err) {
      console.error("Error fetching categories:", err);
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

  const fetchUserBankDetails = async () => {
    try {
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.bankDetails) {
          setUserBankDetails(user.bankDetails);
        }
      }
    } catch (err) {
      console.error("Error fetching user bank details:", err);
    }
  };

  const handleClientSelect = async (clientId) => {
    if (clientId === "add_new") {
      // Refetch clients to get latest data before showing modal
      await fetchClients();
      setShowAddClient(true);
      setFormData((prev) => ({ ...prev, clientId: "", payeeClientName: "" }));
    } else if (clientId) {
      const selectedClient = clients.find((c) => c._id === clientId);
      if (selectedClient) {
        setFormData((prev) => ({
          ...prev,
          clientId: clientId,
          payeeClientName: selectedClient.name,
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, clientId: "", payeeClientName: "" }));
    }
  };

  const handleAddClient = async () => {
    try {
      if (!newClient.name.trim()) {
        toast.error("Client name is required");
        return;
      }
      const response = await axios.post("/clients", newClient);
      if (response.data.success) {
        const addedClient = response.data.data;
        // Refetch to ensure we have the latest client list
        await fetchClients();
        setFormData((prev) => ({
          ...prev,
          clientId: addedClient._id,
          payeeClientName: addedClient.name,
        }));
        setShowAddClient(false);
        setNewClient({
          name: "",
          gstNumber: "",
          email: "",
          phone: "",
          supplyType: "",
          category: "vendor",
          address: "",
        });
        toast.success(`Client "${addedClient.name}" added successfully!`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add client");
    }
  };

  const handleDeleteClient = async () => {
    try {
      const response = await axios.delete(`/clients/${deleteConfirm.clientId}`);
      if (response.data.success) {
        // Refetch to ensure we have the latest client list
        await fetchClients();
        if (formData.clientId === deleteConfirm.clientId) {
          setFormData((prev) => ({
            ...prev,
            clientId: "",
            payeeClientName: "",
          }));
        }
        toast.success(
          `Client "${deleteConfirm.clientName}" deleted successfully!`,
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete client");
    } finally {
      setDeleteConfirm({ show: false, clientId: null, clientName: "" });
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAmountChange = (field, value) => {
    const numValue = parseFloat(value) || 0;
    const updatedData = { ...formData, [field]: value };

    // Auto-calculate postTaxAmount if preTax and tax are available
    if (field === "preTaxAmount" || field === "taxAmount") {
      const preTax =
        field === "preTaxAmount"
          ? numValue
          : parseFloat(formData.preTaxAmount) || 0;
      const tax =
        field === "taxAmount" ? numValue : parseFloat(formData.taxAmount) || 0;
      updatedData.postTaxAmount = (preTax + tax).toFixed(2);
    }

    setFormData(updatedData);
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (type === "invoice") {
      setInvoiceFile(file);
      setUseCamera({ ...useCamera, invoice: false });
    } else {
      setPaymentProofFile(file);
      setUseCamera({ ...useCamera, payment: false });
    }
  };

  const handleCameraCapture = (file, type) => {
    if (type === "invoice") {
      setInvoiceFile(file);
    } else {
      setPaymentProofFile(file);
    }
  };

  const validateForm = () => {
    const errors = [];
    const warns = [];

    // Validate mandatory fields
    if (!formData.category) errors.push("Category is required");
    if (!formData.payeeClientName.trim())
      errors.push("Payee/Client name is required");
    if (!formData.purpose.trim())
      errors.push("Purpose/Description is required");

    // Validate numeric fields are non-negative
    const preTax = parseFloat(formData.preTaxAmount) || 0;
    const tax = parseFloat(formData.taxAmount) || 0;
    const postTax = parseFloat(formData.postTaxAmount) || 0;

    if (preTax < 0) errors.push("Pre-tax amount cannot be negative");
    if (tax < 0) errors.push("Tax amount cannot be negative");
    if (postTax < 0) errors.push("Total amount cannot be negative");
    if (preTax === 0) errors.push("Pre-tax amount must be greater than 0");

    // Validate total equals pre-tax + tax
    const expectedTotal = preTax + tax;
    if (Math.abs(expectedTotal - postTax) > 0.01) {
      errors.push(
        `Total amount (₹${postTax.toFixed(2)}) must equal Pre-tax (₹${preTax.toFixed(2)}) + Tax (₹${tax.toFixed(2)}) = ₹${expectedTotal.toFixed(2)}`,
      );
    }

    // Highlight missing attachments
    if (formData.hasGSTInvoice && !invoiceFile) {
      errors.push("Invoice image is required when GST invoice is selected");
    }
    if (!paymentProofFile) {
      errors.push("Payment proof is required");
    }

    // Warnings for optional but recommended fields
    if (!invoiceFile && !formData.hasGSTInvoice) {
      warns.push(
        "Consider uploading an invoice image for better record keeping",
      );
    }

    setValidationErrors(errors);
    setWarnings(warns);
    return errors.length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Run validation
    if (!validateForm()) {
      setError("Please fix the validation errors before submitting");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setValidationErrors([]);
    setWarnings([]);

    try {
      const formDataToSend = new FormData();

      // Append all text fields
      Object.keys(formData).forEach((key) => {
        formDataToSend.append(key, formData[key]);
      });

      // Append files
      if (invoiceFile) {
        formDataToSend.append("invoiceImage", invoiceFile);
      }
      if (paymentProofFile) {
        formDataToSend.append("paymentProofImage", paymentProofFile);
      }

      const response = await axios.post("/transactions", formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess(
        "Transaction submitted successfully! Waiting for admin approval.",
      );

      // Dispatch event to notify other components (Reports page) about the new transaction
      window.dispatchEvent(
        new CustomEvent("transactionsUpdated", {
          detail: { action: "created" },
        }),
      );

      // Reset form after 2 seconds
      setTimeout(() => {
        navigate("/transactions");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="mb-6 sm:mb-8 animate-slideInUp">
        <div className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3">
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10"
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
                Submit New Expense
              </h1>
              <p className="text-blue-100 text-sm sm:text-base md:text-lg">
                Fill in the expense details below for approval
              </p>
            </div>
            <div className="hidden md:block">
              <svg
                className="w-32 h-32 text-white/20"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path
                  fillRule="evenodd"
                  d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-xl mb-6 shadow-md animate-slideInDown">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 flex-shrink-0"
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
            <div>
              <h3 className="font-bold mb-2">Validation Errors:</h3>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 px-6 py-4 rounded-xl mb-6 shadow-md animate-slideInDown">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 flex-shrink-0"
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
            <div>
              <h3 className="font-bold mb-2">Warnings:</h3>
              <ul className="list-disc list-inside space-y-1">
                {warnings.map((warn, idx) => (
                  <li key={idx}>{warn}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-6 py-4 rounded-xl mb-6 flex items-start gap-3 shadow-md animate-slideInDown">
          <svg
            className="w-6 h-6 flex-shrink-0"
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
          <span className="font-medium">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-6 py-4 rounded-xl mb-6 flex items-start gap-3 shadow-md animate-slideInDown">
          <svg
            className="w-6 h-6 flex-shrink-0"
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
          <span className="font-medium">{success}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl sm:rounded-2xl shadow-soft p-4 sm:p-6 md:p-8 animate-slideInUp"
        style={{ animationDelay: "100ms" }}
      >
        {/* Form Title */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg
              className="w-7 h-7 text-[#0077b6]"
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
            Expense Details
          </h2>
          <p className="text-gray-600 mt-2">
            Please provide accurate information for quick approval
          </p>
        </div>
        {/* Category */}
        <div className="mb-6">
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
            Expense Category *
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleInputChange}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 text-gray-700 font-medium hover:border-[#0077b6]"
            required
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name} ({cat.code})
              </option>
            ))}
          </select>
        </div>

        {/* GST Invoice Toggle */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-white rounded-xl border border-blue-100">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              name="hasGSTInvoice"
              checked={formData.hasGSTInvoice}
              onChange={handleInputChange}
              className="w-6 h-6 text-[#0077b6] border-gray-300 rounded-lg focus:ring-[#0077b6] cursor-pointer"
            />
            <div>
              <span className="text-sm font-bold text-gray-700 group-hover:text-[#0077b6] transition-colors">
                This expense has a GST Invoice
              </span>
              <p className="text-xs text-gray-500 mt-0.5">
                Check if GST is applicable to this transaction
              </p>
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Invoice Date */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 sm:mb-3 flex items-center gap-2">
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
              Invoice Date *
            </label>
            <input
              type="date"
              name="invoiceDate"
              value={formData.invoiceDate}
              onChange={handleInputChange}
              className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6]"
              required
            />
          </div>

          {/* Payee/Client Name */}
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
              Payee/Client *
            </label>
            <select
              name="clientId"
              value={formData.clientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6]"
              required
            >
              <option value="">Select Client/Payee</option>
              {clients.map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name}{" "}
                  {client.gstNumber ? `(${client.gstNumber})` : ""}
                </option>
              ))}
              <option value="add_new">➕ Add New Client</option>
            </select>

            {formData.clientId && formData.clientId !== "add_new" && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  const client = clients.find(
                    (c) => c._id === formData.clientId,
                  );
                  setDeleteConfirm({
                    show: true,
                    clientId: formData.clientId,
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
                Delete Selected Client
              </button>
            )}
          </div>
        </div>

        {/* Add New Client Modal */}
        {showAddClient && (
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-[#0077b6] animate-slideInUp">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#023e8a] flex items-center gap-2">
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
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                Add New Client
              </h3>
              <button
                type="button"
                onClick={() => setShowAddClient(false)}
                className="text-gray-500 hover:text-gray-700"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <input
                type="text"
                placeholder="Client Name *"
                value={newClient.name}
                onChange={(e) =>
                  setNewClient({ ...newClient, name: e.target.value })
                }
                className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
                required
              />
              <input
                type="text"
                placeholder="GST Number (Optional)"
                value={newClient.gstNumber}
                onChange={(e) =>
                  setNewClient({
                    ...newClient,
                    gstNumber: e.target.value.toUpperCase(),
                  })
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
              />
              <input
                type="email"
                placeholder="Email (Optional)"
                value={newClient.email}
                onChange={(e) =>
                  setNewClient({ ...newClient, email: e.target.value })
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
              />
              <input
                type="text"
                placeholder="Phone (Optional)"
                value={newClient.phone}
                onChange={(e) =>
                  setNewClient({ ...newClient, phone: e.target.value })
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
              />
              <input
                type="text"
                placeholder="What they supply (Optional)"
                value={newClient.supplyType}
                onChange={(e) =>
                  setNewClient({ ...newClient, supplyType: e.target.value })
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
              />
              <select
                value={newClient.category}
                onChange={(e) =>
                  setNewClient({ ...newClient, category: e.target.value })
                }
                className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
              >
                <option value="vendor">Vendor</option>
                <option value="supplier">Supplier</option>
                <option value="contractor">Contractor</option>
                <option value="service_provider">Service Provider</option>
                <option value="other">Other</option>
              </select>
            </div>
            <textarea
              placeholder="Address (Optional)"
              value={newClient.address}
              onChange={(e) =>
                setNewClient({ ...newClient, address: e.target.value })
              }
              className="w-full mt-4 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
              rows="2"
            />
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={handleAddClient}
                className="flex-1 bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white font-bold py-3 rounded-xl hover:shadow-lg transition-all"
              >
                Save Client
              </button>
              <button
                type="button"
                onClick={() => setShowAddClient(false)}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Purpose */}
        <div className="mb-6">
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
            Purpose/Description *
          </label>
          <textarea
            name="purpose"
            value={formData.purpose}
            onChange={handleInputChange}
            className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6]"
            placeholder="Provide a detailed description of the expense..."
            rows="4"
            required
          />
        </div>

        {/* Amount Fields */}
        <div className="mb-6 p-6 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Amount Breakup
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pre-Tax Amount (₹) *
              </label>
              <input
                type="number"
                name="preTaxAmount"
                value={formData.preTaxAmount}
                onChange={(e) =>
                  handleAmountChange("preTaxAmount", e.target.value)
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax Amount (₹)
              </label>
              <input
                type="number"
                name="taxAmount"
                value={formData.taxAmount}
                onChange={(e) =>
                  handleAmountChange("taxAmount", e.target.value)
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Total Amount (₹) *
              </label>
              <input
                type="number"
                name="postTaxAmount"
                value={formData.postTaxAmount}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border-2 border-green-200 rounded-xl bg-green-50 font-bold text-green-700 text-lg"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
                readOnly
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Payment Date */}
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
              Payment Date *
            </label>
            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleInputChange}
              className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6]"
              required
            />
          </div>

          {/* Payment Mode */}
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
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              Payment Mode *
            </label>
            <select
              name="paymentMode"
              value={formData.paymentMode}
              onChange={handleInputChange}
              className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 text-gray-700 font-medium hover:border-[#0077b6]"
              required
            >
              <option value="cash">💵 Cash</option>
              <option value="upi">📱 UPI</option>
              <option value="gpay">📱 GPay</option>
              <option value="paytm">📱 Paytm</option>
              <option value="card">💳 Card</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="other">📝 Other</option>
            </select>
          </div>
        </div>

        {/* Bank Details Section - Shows for bank/UPI payments */}
        {["bank_transfer", "upi", "gpay", "paytm"].includes(
          formData.paymentMode,
        ) && (
          <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-[#0077b6] animate-slideInUp">
            <h3 className="text-lg font-bold text-[#023e8a] mb-4 flex items-center gap-2">
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
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
              Bank/Payment Details
              {userBankDetails && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  (Pre-filled from your profile)
                </span>
              )}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction ID / Reference *
                </label>
                <input
                  type="text"
                  name="transactionId"
                  value={formData.transactionId}
                  onChange={handleInputChange}
                  placeholder="Enter transaction/reference ID"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Account Number
                </label>
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  placeholder={
                    userBankDetails?.accountNumber || "Account number"
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                />
              </div>
              {userBankDetails && (
                <>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">
                      Bank Name (from profile)
                    </p>
                    <p className="font-medium text-gray-800">
                      {userBankDetails.bankName || "Not set"}
                    </p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">
                      IFSC Code (from profile)
                    </p>
                    <p className="font-medium text-gray-800">
                      {userBankDetails.ifscCode || "Not set"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* File Uploads */}
        <div className="mb-6 p-6 bg-gradient-to-br from-purple-50 to-white rounded-xl border border-purple-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Upload Documents
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Image */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Invoice/Bill Image{" "}
                {formData.hasGSTInvoice && (
                  <span className="text-red-500">*</span>
                )}
              </label>

              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setUseCamera({ ...useCamera, invoice: false })}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    !useCamera.invoice
                      ? "bg-[#0077b6] text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  📁 Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUseCamera({ ...useCamera, invoice: true })}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    useCamera.invoice
                      ? "bg-[#0077b6] text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  📸 Use Camera
                </button>
              </div>

              {!useCamera.invoice ? (
                <>
                  <input
                    type="file"
                    id="invoice-file-input"
                    onChange={(e) => handleFileChange(e, "invoice")}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6] cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-[#0077b6] hover:file:bg-blue-100 file:cursor-pointer"
                    accept="image/*,.pdf"
                    required={formData.hasGSTInvoice && !invoiceFile}
                  />
                  {invoiceFile && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
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
                      {invoiceFile.name}
                    </p>
                  )}
                </>
              ) : (
                <CameraCapture
                  onCapture={(file) => handleCameraCapture(file, "invoice")}
                  label="Capture Invoice"
                />
              )}
            </div>

            {/* Payment Proof */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Payment Proof <span className="text-red-500">*</span>
              </label>

              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setUseCamera({ ...useCamera, payment: false })}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    !useCamera.payment
                      ? "bg-[#0077b6] text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  📁 Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUseCamera({ ...useCamera, payment: true })}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                    useCamera.payment
                      ? "bg-[#0077b6] text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  📸 Use Camera
                </button>
              </div>

              {!useCamera.payment ? (
                <>
                  <input
                    type="file"
                    id="payment-file-input"
                    onChange={(e) => handleFileChange(e, "payment")}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all duration-300 hover:border-[#0077b6] cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-[#0077b6] hover:file:bg-blue-100 file:cursor-pointer"
                    accept="image/*,.pdf"
                    required={!paymentProofFile}
                  />
                  {paymentProofFile && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
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
                      {paymentProofFile.name}
                    </p>
                  )}
                </>
              ) : (
                <CameraCapture
                  onCapture={(file) => handleCameraCapture(file, "payment")}
                  label="Capture Payment Proof"
                />
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => navigate("/transactions")}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-300 font-semibold flex items-center gap-2"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white font-bold rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Submitting...
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Submit Expense
              </>
            )}
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
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
                Delete Client?
              </h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <strong>"{deleteConfirm.clientName}"</strong>? This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setDeleteConfirm({
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

export default NewTransaction;
