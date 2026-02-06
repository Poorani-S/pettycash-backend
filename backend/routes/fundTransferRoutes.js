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

// Admin and Manager routes
router.post("/", authorize("admin", "manager"), addFunds);
router.get("/", authorize("admin", "manager"), getFundTransfers);
router.get(
  "/stats/summary",
  authorize("admin", "manager"),
  getFundTransferStats,
);
router.delete(
  "/clear-history",
  authorize("admin", "manager"),
  clearFundTransferHistory,
);
router.get("/:id", authorize("admin", "manager"), getFundTransferById);
router.delete("/:id", authorize("admin", "manager"), deleteFundTransfer);

module.exports = router;
