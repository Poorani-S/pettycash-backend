import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axios";
import { toast } from "react-toastify";
import CameraCapture from "../components/CameraCapture";

const SubmitExpense = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showInvoiceCamera, setShowInvoiceCamera] = useState(false);
  const [showPaymentCamera, setShowPaymentCamera] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    amount: "",
    transactionDate: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash",
    payeeClientName: "",
    purpose: "",
    hasGSTInvoice: false,
    invoiceDate: "",
    preTaxAmount: "",
    taxAmount: "",
    postTaxAmount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [invoiceImage, setInvoiceImage] = useState(null);
  const [paymentProofImage, setPaymentProofImage] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [paymentPreview, setPaymentPreview] = useState(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/categories");
      setCategories(response.data.data);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleInvoiceChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setInvoiceImage(file);
      setInvoicePreview(URL.createObjectURL(file));
      setShowInvoiceCamera(false);
    }
  };

  const handlePaymentProofChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentProofImage(file);
      setPaymentPreview(URL.createObjectURL(file));
      setShowPaymentCamera(false);
    }
  };

  const handleInvoiceCameraCapture = (file) => {
    setInvoiceImage(file);
    setInvoicePreview(URL.createObjectURL(file));
    setShowInvoiceCamera(false);
  };

  const handlePaymentCameraCapture = (file) => {
    setPaymentProofImage(file);
    setPaymentPreview(URL.createObjectURL(file));
    setShowPaymentCamera(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const data = new FormData();

      // Append form fields
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== "" && formData[key] !== null) {
          data.append(key, formData[key]);
        }
      });

      // Append files
      if (invoiceImage) {
        data.append("invoiceImage", invoiceImage);
      }
      if (paymentProofImage) {
        data.append("paymentProofImage", paymentProofImage);
      }

      const response = await axios.post("/transactions", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess("Expense submitted successfully!");
      // Dispatch event to notify other components (Reports page) about the new transaction
      window.dispatchEvent(
        new CustomEvent("transactionsUpdated", {
          detail: { action: "created" },
        }),
      );
      setTimeout(() => {
        navigate("/transactions");
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-blue-600 text-white py-6 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Submit Expense</h1>
            <p className="text-blue-100 mt-2">
              Create a new petty cash expense request
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white border border-blue-100 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                1
              </span>
              Basic Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Expense Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Office Supplies Purchase"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description/Purpose *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Describe the expense..."
                  rows="3"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category *
                </label>
                <div className="relative">
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name} ({cat.code})
                      </option>
                    ))}
                  </select>
                  {formData.category && (
                    <button
                      type="button"
                      onClick={async () => {
                        const catToDelete = categories.find(
                          (c) => c._id === formData.category,
                        );
                        if (
                          window.confirm(
                            `Delete category "${catToDelete?.name}"?\n\nThis will permanently remove this category.`,
                          )
                        ) {
                          try {
                            await axios.delete(
                              `/categories/${formData.category}`,
                            );
                            toast.success("Category deleted successfully");
                            setFormData({ ...formData, category: "" });
                            // Refresh categories
                            const response = await axios.get("/categories");
                            setCategories(response.data.data);
                          } catch (error) {
                            toast.error(
                              error.response?.data?.message ||
                                "Failed to delete category",
                            );
                          }
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete category"
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
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Method *
                </label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payee/Client Name *
                </label>
                <input
                  type="text"
                  name="payeeClientName"
                  value={formData.payeeClientName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Vendor or client name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction Date *
                </label>
                <input
                  type="date"
                  name="transactionDate"
                  value={formData.transactionDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* GST & Amount Details */}
          <div className="bg-white border border-blue-100 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                2
              </span>
              Amount & GST Details
            </h2>

            <div className="mb-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  name="hasGSTInvoice"
                  checked={formData.hasGSTInvoice}
                  onChange={handleChange}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-700">
                  This expense has a GST Invoice
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.hasGSTInvoice ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Pre-Tax Amount (₹) *
                    </label>
                    <input
                      type="number"
                      name="preTaxAmount"
                      value={formData.preTaxAmount}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Amount before tax"
                      step="any"
                      required={formData.hasGSTInvoice}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tax Amount (₹) *
                    </label>
                    <input
                      type="number"
                      name="taxAmount"
                      value={formData.taxAmount}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="GST amount"
                      step="any"
                      required={formData.hasGSTInvoice}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Post-Tax Amount (₹) *
                    </label>
                    <input
                      type="number"
                      name="postTaxAmount"
                      value={formData.postTaxAmount}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Total amount"
                      step="any"
                      required={formData.hasGSTInvoice}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Invoice Date *
                    </label>
                    <input
                      type="date"
                      name="invoiceDate"
                      value={formData.invoiceDate}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required={formData.hasGSTInvoice}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter amount"
                    step="any"
                    required={!formData.hasGSTInvoice}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Date *
                </label>
                <input
                  type="date"
                  name="paymentDate"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* File Uploads */}
          <div className="bg-white border border-blue-100 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
              <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                3
              </span>
              Upload Documents
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Invoice Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Invoice/Bill Image
                </label>

                {/* Upload/Camera Buttons */}
                {!invoicePreview && !showInvoiceCamera && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("invoiceImage").click()
                      }
                      className="w-full px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
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
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      📁 Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInvoiceCamera(true)}
                      className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
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
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      📸 Use Camera
                    </button>
                  </div>
                )}

                {/* Hidden File Input - Support all formats */}
                <input
                  type="file"
                  id="invoiceImage"
                  onChange={handleInvoiceChange}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                />

                {/* Camera Capture Component */}
                {showInvoiceCamera && (
                  <div className="space-y-3">
                    <CameraCapture
                      onCapture={handleInvoiceCameraCapture}
                      label="Capture Invoice"
                    />
                    <button
                      type="button"
                      onClick={() => setShowInvoiceCamera(false)}
                      className="w-full px-4 py-2 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                    >
                      Cancel Camera
                    </button>
                  </div>
                )}

                {/* Preview */}
                {invoicePreview && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <div className="relative">
                      {invoiceImage?.type?.startsWith("image/") ? (
                        <img
                          src={invoicePreview}
                          alt="Invoice preview"
                          className="max-h-40 mx-auto mb-2 rounded"
                        />
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <svg
                            className="w-12 h-12 text-blue-500 mb-2"
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
                          <p className="text-sm text-gray-600 font-medium">
                            {invoiceImage?.name}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceImage(null);
                          setInvoicePreview(null);
                        }}
                        className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Supports: Images, PDF, DOC, DOCX, XLS, XLSX, TXT (Max 5MB)
                </p>
              </div>

              {/* Payment Proof Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Proof *
                </label>

                {/* Upload/Camera Buttons */}
                {!paymentPreview && !showPaymentCamera && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        document.getElementById("paymentProofImage").click()
                      }
                      className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
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
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      📁 Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPaymentCamera(true)}
                      className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 shadow-md"
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
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      📸 Capture Invoice
                    </button>
                  </div>
                )}

                {/* Hidden File Input - Support all formats */}
                <input
                  type="file"
                  id="paymentProofImage"
                  onChange={handlePaymentProofChange}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="hidden"
                />

                {/* Camera Capture Component */}
                {showPaymentCamera && (
                  <div className="space-y-3">
                    <CameraCapture
                      onCapture={handlePaymentCameraCapture}
                      label="Capture Payment Proof"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPaymentCamera(false)}
                      className="w-full px-4 py-2 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all"
                    >
                      Cancel Camera
                    </button>
                  </div>
                )}

                {/* Preview */}
                {paymentPreview && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <div className="relative">
                      {paymentProofImage?.type?.startsWith("image/") ? (
                        <img
                          src={paymentPreview}
                          alt="Payment proof preview"
                          className="max-h-40 mx-auto mb-2 rounded"
                        />
                      ) : (
                        <div className="flex flex-col items-center py-4">
                          <svg
                            className="w-12 h-12 text-blue-500 mb-2"
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
                          <p className="text-sm text-gray-600 font-medium">
                            {paymentProofImage?.name}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentProofImage(null);
                          setPaymentPreview(null);
                        }}
                        className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  Supports: Images, PDF, DOC, DOCX, XLS, XLSX, TXT (Max 5MB)
                </p>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="bg-white border border-blue-100 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              Additional Notes
            </h2>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Any additional information..."
              rows="4"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubmitExpense;
