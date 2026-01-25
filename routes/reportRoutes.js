const express = require("express");
const router = express.Router();
const {
  getSummaryReport,
  getCategoryReport,
  getMonthlyTrend,
  exportPDF,
  exportExcel,
  getBalanceOverview,
  getReconciliationReport,
} = require("../controllers/reportController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(protect);

// Report routes
router.get("/summary", getSummaryReport);
router.get("/by-category", getCategoryReport);
router.get("/monthly-trend", getMonthlyTrend);
router.get("/balance-overview", getBalanceOverview);
router.get(
  "/reconciliation",
  authorize("admin", "manager", "approver", "auditor"),
  getReconciliationReport,
);

// Export routes
router.get("/export/pdf", exportPDF);
router.get("/export/excel", exportExcel);

module.exports = router;
