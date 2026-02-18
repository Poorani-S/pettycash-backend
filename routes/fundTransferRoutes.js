const express = require("express");
const router = express.Router();
const {
  addFunds,
  getFundTransfers,
  getFundTransferById,
  getCurrentBalance,
  getFundTransferStats,
  deleteFundTransfer,
  clearFundTransferHistory,
} = require("../controllers/fundTransferController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// Balance route - accessible to all authenticated users
router.get("/balance/current", getCurrentBalance);

// Fund transfer history - accessible to all authenticated users (read-only)
router.get("/", getFundTransfers);
router.get("/stats/summary", getFundTransferStats);
router.get("/:id", getFundTransferById);

// Admin and Manager only routes (creating, deleting)
router.post("/", authorize("admin", "manager"), addFunds);
router.delete(
  "/clear-history",
  authorize("admin", "manager"),
  clearFundTransferHistory,
);
router.delete("/:id", authorize("admin", "manager"), deleteFundTransfer);

module.exports = router;
