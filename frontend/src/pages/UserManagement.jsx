import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import axios from "../utils/axios";

function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [activeTab, setActiveTab] = useState("users"); // "users" or "history"
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: "employee",
    managerId: "",
    department: "",
    employeeNumber: "",
    approvalLimit: "",
    bankDetails: {
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      branchName: "",
    },
    panNumber: "",
    address: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user"));
    if (
      !userData ||
      (userData.role !== "admin" && userData.role !== "manager")
    ) {
      navigate("/dashboard");
      return;
    }
    fetchUsers();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === "history") {
      fetchActivityLogs();
    }
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(""); // Clear any previous errors
      const response = await axios.get("/users");
      setUsers(response.data.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      // Don't show error to user, just set empty users list
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      setLoadingActivity(true);
      const response = await axios.get("/user-activity");
      setActivityLogs(response.data.data || []);
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setActivityLogs([]);
    } finally {
      setLoadingActivity(false);
    }
  };

  const exportActivityPDF = async () => {
    try {
      setLoadingActivity(true);
      const response = await axios.get("/user-activity/export/pdf", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `user-activity-log-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSuccess("Activity log downloaded successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error exporting PDF:", err);
      setError("Failed to export activity log");
    } finally {
      setLoadingActivity(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Handle nested bankDetails fields
    if (name.startsWith("bankDetails.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const payload = {
        ...formData,
        approvalLimit:
          formData.role === "approver" && formData.approvalLimit
            ? Number(formData.approvalLimit)
            : null,
      };

      if (editingUser) {
        await axios.put(`/users/${editingUser._id}`, payload);
        setSuccess("User updated successfully!");
      } else {
        const response = await axios.post("/users", payload);
        if (response.data.emailSent) {
          setSuccess(
            "User created successfully! Invitation email sent to " +
              formData.email,
          );
        } else {
          setError(
            "User created but invitation email failed to send. Error: " +
              (response.data.emailError || "Check email configuration"),
          );
          setSuccess("User account created for " + formData.email);
        }
      }

      setShowAddModal(false);
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        role: "custodian",
        department: "",
        employeeNumber: "",
        approvalLimit: "",
        bankDetails: {
          bankName: "",
          accountNumber: "",
          ifscCode: "",
          branchName: "",
        },
        panNumber: "",
        address: "",
      });
      fetchUsers();

      // Trigger custom event to notify other components about user list changes
      window.dispatchEvent(
        new CustomEvent("usersUpdated", {
          detail: { timestamp: Date.now() },
        }),
      );

      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save user");
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: "", // Don't populate password field when editing
      role: user.role,
      department: user.department || "",
      employeeNumber: user.employeeNumber || "",
      approvalLimit: user.approvalLimit || "",
      bankDetails: user.bankDetails || {
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branchName: "",
      },
      panNumber: user.panNumber || "",
      address: user.address || "",
    });
    setShowAddModal(true);
  };

  const handleDeactivate = async (userId, userName) => {
    if (
      !confirm(
        `Are you sure you want to deactivate ${userName}? They will no longer be able to login.`,
      )
    ) {
      return;
    }

    try {
      await axios.patch(`/users/${userId}/deactivate`);
      setSuccess("User deactivated successfully");
      fetchUsers();

      // Trigger custom event to notify other components about user list changes
      window.dispatchEvent(
        new CustomEvent("usersUpdated", {
          detail: { timestamp: Date.now() },
        }),
      );

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to deactivate user");
    }
  };

  const handleDeleteUserFromLog = async (userId, userName) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete ${userName}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await axios.delete(`/users/${userId}`);
      setSuccess(`User ${userName} deleted successfully`);
      fetchUsers();
      fetchActivityLogs(); // Refresh activity logs

      // Trigger custom event to notify other components about user list changes
      window.dispatchEvent(
        new CustomEvent("usersUpdated", {
          detail: { timestamp: Date.now() },
        }),
      );

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleResendInvitation = async (userId, userName, userEmail) => {
    if (!confirm(`Resend invitation email to ${userName} (${userEmail})?`)) {
      return;
    }

    try {
      await axios.post(`/users/${userId}/resend-invitation`);
      setSuccess(`Invitation email sent successfully to ${userEmail}`);
      setTimeout(() => setSuccess(""), 5000);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to send invitation email",
      );
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      role: "custodian",
      department: "",
      employeeNumber: "",
      approvalLimit: "",
      bankDetails: {
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        branchName: "",
      },
      panNumber: "",
      address: "",
    });
    setShowAddModal(true);
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: "bg-purple-100 text-purple-800 border-purple-200",
      manager: "bg-indigo-100 text-indigo-800 border-indigo-200",
      employee: "bg-cyan-100 text-cyan-800 border-cyan-200",
      intern: "bg-pink-100 text-pink-800 border-pink-200",
      custodian: "bg-blue-100 text-blue-800 border-blue-200",
      approver: "bg-green-100 text-green-800 border-green-200",
      auditor: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    return colors[role] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  const getRoleIcon = (role) => {
    const icons = {
      admin: "👑",
      manager: "📋",
      employee: "👤",
      intern: "🎓",
      custodian: "💼",
      approver: "✅",
      auditor: "👁️",
    };
    return icons[role] || "👤";
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 animate-slideInUp">
        <div className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] rounded-3xl p-8 text-white shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
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
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
                User Management
              </h1>
              <p className="text-blue-100 text-lg">
                Manage users, roles, and permissions
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="hidden md:flex items-center gap-2 bg-white text-[#0077b6] px-6 py-3 rounded-xl font-bold hover:bg-blue-50 transition-all duration-300 shadow-lg"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add New User
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Add Button */}
      <button
        onClick={openAddModal}
        className="md:hidden fixed bottom-6 right-6 bg-[#0077b6] text-white p-4 rounded-full shadow-2xl hover:bg-[#023e8a] transition-all duration-300 z-50"
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>

      {/* Hierarchy Info Box */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-[#0077b6] p-5 rounded-xl mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Organization Hierarchy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👑</span>
            <div>
              <p className="font-semibold text-gray-700">1. Admin/CEO</p>
              <p className="text-xs text-gray-600">
                Full control, creates all users
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📋</span>
            <div>
              <p className="font-semibold text-gray-700">2. Manager</p>
              <p className="text-xs text-gray-600">Adds employees & interns</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-semibold text-gray-700">3. Employee</p>
              <p className="text-xs text-gray-600">Reports to manager</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <div>
              <p className="font-semibold text-gray-700">4. Intern</p>
              <p className="text-xs text-gray-600">
                Entry-level, reports to manager
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-xl mb-6 animate-slideInDown">
          <div className="flex items-center gap-2">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-xl mb-6 animate-slideInDown">
          <div className="flex items-center gap-2">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{success}</span>
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
            activeTab === "users"
              ? "bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white shadow-lg"
              : "bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200"
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
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Users
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
            activeTab === "history"
              ? "bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white shadow-lg"
              : "bg-white text-gray-600 hover:bg-gray-50 border-2 border-gray-200"
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Activity History
        </button>
        {activeTab === "history" && (
          <button
            onClick={exportActivityPDF}
            disabled={loadingActivity}
            className="ml-auto flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold hover:shadow-lg transition-all duration-300 disabled:opacity-50"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {loadingActivity ? "Exporting..." : "Download PDF"}
          </button>
        )}
      </div>

      {/* Activity History Tab */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl shadow-soft p-6 animate-slideInUp">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            User Management Activity Log
          </h2>

          {loadingActivity ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-[#0077b6] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading activity...</p>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-300"
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
              No activity logs found
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {activityLogs.map((log, index) => (
                <div
                  key={log._id}
                  className="p-4 bg-gray-50 rounded-xl border-l-4 border-[#0077b6] hover:shadow-md transition-all duration-300"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          log.action === "created"
                            ? "bg-green-100 text-green-700"
                            : log.action === "updated"
                              ? "bg-blue-100 text-blue-700"
                              : log.action === "deleted"
                                ? "bg-red-100 text-red-700"
                                : log.action === "deactivated"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : log.action === "reactivated"
                                    ? "bg-cyan-100 text-cyan-700"
                                    : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {log.action?.toUpperCase()}
                      </span>
                      {log.targetUser?._id && log.action !== "deleted" && (
                        <button
                          onClick={() =>
                            handleDeleteUserFromLog(
                              log.targetUser._id,
                              log.targetUser.name,
                            )
                          }
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete this user"
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
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  <p className="font-medium text-gray-800">
                    <span className="text-[#0077b6]">
                      {log.performedBy?.name || "System"}
                    </span>{" "}
                    {log.action}{" "}
                    <span className="text-[#023e8a]">
                      {log.targetUser?.name ||
                        log.details?.targetUserName ||
                        "Unknown User"}
                    </span>
                  </p>
                  {log.details?.changes && (
                    <p className="text-sm text-gray-600 mt-1">
                      Changes: {log.details.changes.join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Users List */}
      {activeTab === "users" && (
        <div className="bg-white rounded-2xl shadow-soft p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-[#0077b6] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="w-16 h-16 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="text-gray-600 text-lg">No users found</p>
              <button
                onClick={openAddModal}
                className="mt-4 text-[#0077b6] font-semibold hover:underline"
              >
                Add your first user
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      User
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Employee #
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Role
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Reports To
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Contact
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Created By
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Login Status
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-4 px-4 font-bold text-gray-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#0077b6] to-[#023e8a] rounded-full flex items-center justify-center text-white font-bold">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {user.name}
                            </p>
                            {user.department && (
                              <p className="text-sm text-gray-500">
                                {user.department}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-700 font-mono">
                          {user.employeeNumber || (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border ${getRoleBadgeColor(
                            user.role,
                          )}`}
                        >
                          {getRoleIcon(user.role)}
                          {user.role.charAt(0).toUpperCase() +
                            user.role.slice(1)}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {user.managerId ? (
                          <div className="text-sm">
                            <p className="font-medium text-gray-700">
                              📋 {user.managerId.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {user.managerId.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">
                            {user.role === "admin" ? "CEO" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-gray-700">{user.email}</p>
                        <p className="text-sm text-gray-500">{user.phone}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          {user.createdBy ? (
                            <div>
                              <p className="font-medium text-gray-700">
                                {user.createdBy.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {user.createdBy.email}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">System</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {user.lastLogin ? (
                          <div className="text-sm">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold mb-1">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              Logged In
                            </span>
                            <p className="text-xs text-gray-500">
                              {new Date(user.lastLogin).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            Never
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {user.isActive ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-semibold">
                            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-[#0077b6] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          {user.isActive && (
                            <button
                              onClick={() =>
                                handleDeactivate(user._id, user.name)
                              }
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Deactivate"
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
                                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                />
                              </svg>
                            </button>
                          )}
                          {user.isActive && (
                            <button
                              onClick={() =>
                                handleResendInvitation(
                                  user._id,
                                  user.name,
                                  user.email,
                                )
                              }
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Resend Invitation Email"
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
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#023e8a] to-[#0077b6] p-6 text-white rounded-t-2xl">
              <h2 className="text-2xl font-bold">
                {editingUser ? "Edit User" : "Add New User"}
              </h2>
              <p className="text-blue-100 mt-1">
                {editingUser
                  ? "Update user information"
                  : "Create a new user account with invitation"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    required
                    disabled={editingUser !== null}
                  />
                  {!editingUser && (
                    <p className="text-sm text-gray-500 mt-1">
                      Invitation email will be sent to this address
                    </p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    required
                  />
                </div>

                {/* Password - Optional */}
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Password (Optional)
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="Leave empty to allow OTP-only login"
                      minLength={6}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      If provided, user can login with password or OTP. If not
                      provided, user can only login with OTP.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Role */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Role *
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      required
                    >
                      <option value="employee">
                        👤 Employee (Submit expenses)
                      </option>
                      <option value="intern">🎓 Intern (Entry-level)</option>
                      <option value="manager">
                        📋 Manager (Manage team & approve)
                      </option>
                      <option value="custodian">
                        💼 Custodian (Create expenses)
                      </option>
                      <option value="approver">
                        ✅ Approver (Review & approve)
                      </option>
                      <option value="admin">👑 Admin (Full access)</option>
                      <option value="auditor">👁️ Auditor (Read-only)</option>
                    </select>
                  </div>

                  {/* Manager Assignment - For employees and interns */}
                  {(formData.role === "employee" ||
                    formData.role === "intern") && (
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        Assign Manager *
                      </label>
                      <select
                        name="managerId"
                        value={formData.managerId}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                        required
                      >
                        <option value="">Select a manager</option>
                        {users
                          .filter((u) => u.role === "manager")
                          .map((manager) => (
                            <option key={manager._id} value={manager._id}>
                              {manager.name} - {manager.department || "No Dept"}
                            </option>
                          ))}
                      </select>
                      <p className="text-sm text-gray-500 mt-1">
                        {formData.role === "employee" ? "Employee" : "Intern"}{" "}
                        will report to this manager
                      </p>
                    </div>
                  )}

                  {/* Department */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Department
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="e.g., Operations, Marketing"
                    />
                  </div>

                  {/* Employee Number */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Employee Number
                    </label>
                    <input
                      type="text"
                      name="employeeNumber"
                      value={formData.employeeNumber}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="e.g., EMP001"
                    />
                  </div>
                </div>

                {/* Approval Limit (only for approvers) */}
                {formData.role === "approver" && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Approval Limit (₹)
                    </label>
                    <input
                      type="number"
                      name="approvalLimit"
                      value={formData.approvalLimit}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                      placeholder="e.g., 50000"
                      min="0"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Maximum amount this approver can approve. Leave empty for
                      no limit.
                    </p>
                  </div>
                )}

                {/* Bank Details Section */}
                <div className="p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
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
                    Bank Details (Optional)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="bankDetails.bankName"
                      value={formData.bankDetails.bankName}
                      onChange={handleInputChange}
                      placeholder="Bank Name"
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    />
                    <input
                      type="text"
                      name="bankDetails.accountNumber"
                      value={formData.bankDetails.accountNumber}
                      onChange={handleInputChange}
                      placeholder="Account Number"
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    />
                    <input
                      type="text"
                      name="bankDetails.ifscCode"
                      value={formData.bankDetails.ifscCode}
                      onChange={handleInputChange}
                      placeholder="IFSC Code"
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all uppercase"
                    />
                    <input
                      type="text"
                      name="bankDetails.branchName"
                      value={formData.bankDetails.branchName}
                      onChange={handleInputChange}
                      placeholder="Branch Name"
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                    />
                    <input
                      type="text"
                      name="panNumber"
                      value={formData.panNumber}
                      onChange={handleInputChange}
                      placeholder="PAN Number"
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all uppercase"
                    />
                  </div>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Address"
                    rows="2"
                    className="w-full mt-4 px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6] transition-all"
                  />
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-sm text-blue-800">
                      {editingUser ? (
                        <p>
                          User will be notified of any changes to their account
                        </p>
                      ) : (
                        <>
                          <p className="font-semibold mb-1">
                            📧 Invitation Email
                          </p>
                          <p>
                            An automated invitation will be sent with login
                            instructions and OTP setup guide. The user can login
                            immediately using their email and OTP.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingUser(null);
                    setFormData({
                      name: "",
                      email: "",
                      phone: "",
                      password: "",
                      role: "custodian",
                      department: "",
                      employeeNumber: "",
                      approvalLimit: "",
                      bankDetails: {
                        bankName: "",
                        accountNumber: "",
                        ifscCode: "",
                        branchName: "",
                      },
                      panNumber: "",
                      address: "",
                    });
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white rounded-xl hover:shadow-lg transition-all font-semibold"
                >
                  {editingUser ? "Update User" : "Create User & Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default UserManagement;
