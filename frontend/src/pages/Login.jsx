import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("password");
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showOTPFallback, setShowOTPFallback] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: email.trim(),
        password: password,
      });

      if (response.data.success) {
        setSuccess("Login successful! Redirecting...");
        localStorage.setItem("token", response.data.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.data));
        setTimeout(() => navigate("/dashboard"), 1000);
      }
    } catch (err) {
      const responseData = err.response?.data;
      const message =
        responseData?.message || "Login failed. Please try again.";

      // Check if 3 failed attempts reached
      if (responseData?.suggestOTP || responseData?.failedAttempts >= 3) {
        setShowOTPFallback(true);
        setFailedAttempts(responseData?.failedAttempts || 3);
        setError(message + " You can now use OTP login below.");
      } else {
        setError(message);
        setFailedAttempts(responseData?.failedAttempts || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/request-otp`, {
        email: email.trim(),
      });
      if (response.data.success) {
        setSuccess(response.data.message);
        setStep(2);
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const switchToOTPMode = () => {
    setMode("otp");
    setStep(1);
    setError("");
    setSuccess("");
    setShowOTPFallback(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/verify-otp`, {
        email: email.trim(),
        otp: otp.trim(),
      });
      if (response.data.success) {
        setSuccess("Login successful! Redirecting...");
        localStorage.setItem("token", response.data.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.data));
        setTimeout(() => navigate("/dashboard"), 1000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#023e8a] via-[#0077b6] to-[#00b4d8] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      <div className="bg-white rounded-3xl shadow-2xl p-10 w-full max-w-md relative z-10 animate-slideInUp">
        <div className="text-center mb-8">
          <img
            src="/kambaa-logo.png"
            alt="Logo"
            className="h-20 w-auto mx-auto mb-4 drop-shadow-lg"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#023e8a] to-[#0077b6] bg-clip-text text-transparent mb-2">
            Petty Cash Management
          </h1>
          <p className="text-gray-600 text-sm">
            {mode === "password"
              ? "Sign in to your account"
              : step === 1
                ? "Reset via OTP"
                : "Enter OTP"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
            <p className="text-green-700 text-sm">{success}</p>
          </div>
        )}

        {mode === "password" && (
          <form onSubmit={handlePasswordLogin} className="space-y-5">
            <div>
              <label className="block text-[#023e8a] font-semibold mb-2 text-sm">
                Email Address
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-[#023e8a] font-semibold mb-2 text-sm">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-3 pr-11 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                      d={
                        showPassword
                          ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                          : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      }
                    />
                  </svg>
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            {showOTPFallback && (
              <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                <p className="text-amber-800 text-sm mb-3">
                  ⚠️ You have {failedAttempts} failed login attempt(s). Admin
                  has been notified.
                </p>
                <button
                  type="button"
                  onClick={switchToOTPMode}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold py-2.5 rounded-lg shadow hover:shadow-lg transition"
                >
                  Switch to OTP Login
                </button>
              </div>
            )}

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={switchToOTPMode}
                className="text-[#0077b6] hover:text-[#023e8a] font-medium text-sm hover:underline"
              >
                Forgot Password? Login with OTP
              </button>
            </div>
          </form>
        )}

        {mode === "otp" && step === 1 && (
          <form onSubmit={handleRequestOTP} className="space-y-5">
            <div>
              <label className="block text-[#023e8a] font-semibold mb-2 text-sm">
                Email Address
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0077b6] focus:border-[#0077b6]"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? "Sending OTP..." : "Send OTP"}
            </button>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setError("");
                  setSuccess("");
                  setShowOTPFallback(false);
                  setFailedAttempts(0);
                }}
                className="text-[#0077b6] hover:text-[#023e8a] font-medium text-sm hover:underline"
              >
                ← Back to Password Login
              </button>
            </div>
          </form>
        )}

        {mode === "otp" && step === 2 && (
          <form onSubmit={handleVerifyOTP} className="space-y-5">
            <div>
              <label className="block text-[#023e8a] font-semibold mb-2 text-sm">
                Enter 6-Digit OTP
              </label>
              <input
                type="text"
                className="w-full px-4 py-4 border-2 border-gray-200 rounded-xl text-center text-2xl tracking-widest font-mono font-bold text-[#023e8a]"
                placeholder="000000"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                required
                disabled={loading}
                autoFocus
              />
              <p className="text-[#0077b6] text-xs mt-2 text-center">
                📧 OTP sent to {email}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-[#023e8a] to-[#0077b6] text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Login"}
            </button>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                  setSuccess("");
                }}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                ← Change Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtp("");
                  handleRequestOTP({ preventDefault: () => {} });
                }}
                disabled={countdown > 0}
                className="text-[#0077b6] text-sm disabled:text-gray-400"
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-500 text-xs">
            © 2026 Petty Cash Management System
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
