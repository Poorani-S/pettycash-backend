import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../utils/axios";

const SubmitExpense = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
    }
  };

  const handlePaymentProofChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPaymentProofImage(file);
      setPaymentPreview(URL.createObjectURL(file));
    }
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
                      step="0.01"
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
                      step="0.01"
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
                      step="0.01"
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
                    step="0.01"
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
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
                  <input
                    type="file"
                    id="invoiceImage"
                    onChange={handleInvoiceChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <label htmlFor="invoiceImage" className="cursor-pointer">
                    {invoicePreview ? (
                      <div>
                        <img
                          src={invoicePreview}
                          alt="Invoice preview"
                          className="max-h-40 mx-auto mb-2 rounded"
                        />
                        <p className="text-sm text-blue-600 font-medium">
                          Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-gray-600">
                          Click to upload invoice
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, PDF up to 5MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Payment Proof Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Proof (GPay/UPI Screenshot)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
                  <input
                    type="file"
                    id="paymentProofImage"
                    onChange={handlePaymentProofChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                  />
                  <label htmlFor="paymentProofImage" className="cursor-pointer">
                    {paymentPreview ? (
                      <div>
                        <img
                          src={paymentPreview}
                          alt="Payment proof preview"
                          className="max-h-40 mx-auto mb-2 rounded"
                        />
                        <p className="text-sm text-blue-600 font-medium">
                          Click to change
                        </p>
                      </div>
                    ) : (
                      <div>
                        <svg
                          className="mx-auto h-12 w-12 text-gray-400"
                          stroke="currentColor"
                          fill="none"
                          viewBox="0 0 48 48"
                        >
                          <path
                            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <p className="mt-2 text-sm text-gray-600">
                          Click to upload payment proof
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, PDF up to 5MB
                        </p>
                      </div>
                    )}
                  </label>
                </div>
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
