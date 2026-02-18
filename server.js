const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const connectDB = require("./config/database");

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Connect to database
connectDB().catch((err) => {
  console.error("Database connection failed. Starting server without DB...");
  if (process.env.NODE_ENV === "production") {
    console.error("Warning: Production server running without database!");
  }
});

// CORS Configuration - Allow multiple origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Note: File serving is now protected via /api/files routes
// app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // REMOVED for security

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Petty Cash API is running...",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/transactions", require("./routes/transactionRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/reports", require("./routes/reportRoutes"));
app.use("/api/fund-transfers", require("./routes/fundTransferRoutes"));
app.use("/api/clients", require("./routes/clientRoutes"));
app.use("/api/user-activity", require("./routes/userActivityRoutes"));
app.use("/api/files", require("./routes/fileRoutes")); // Protected file access

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `✅ Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
  console.log(`✅ CORS enabled for: ${corsOptions.origin}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  if (process.env.NODE_ENV === "production") {
    // In production, you might want to restart the server
    console.error("Shutting down server due to unhandled rejection...");
    process.exit(1);
  }
});

module.exports = app;
