const express = require("express");
const router = express.Router();
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  submitTransaction,
  approveTransaction,
  rejectTransaction,
  markAsPaid,
  simpleApproveTransaction,
  simpleRejectTransaction,
  requestAdditionalInfo,
  sendCEOReport,
} = require("../controllers/transactionController");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  uploadMultiple,
  handleUploadError,
} = require("../middleware/uploadMiddleware");

router
  .route("/")
  .get(protect, getTransactions)
  .post(protect, uploadMultiple, handleUploadError, createTransaction);

// CEO Report endpoint - must be before /:id routes
router.post("/send-ceo-report", protect, authorize("admin"), sendCEOReport);

router
  .route("/:id")
  .get(protect, getTransaction)
  .put(protect, uploadMultiple, handleUploadError, updateTransaction)
  .delete(protect, authorize("admin"), deleteTransaction);

router.post("/:id/submit", protect, submitTransaction);
router.patch(
  "/:id/approve",
  protect,
  authorize("admin", "manager"),
  simpleApproveTransaction,
);
router.patch(
  "/:id/reject",
  protect,
  authorize("admin", "manager"),
  simpleRejectTransaction,
);
router.post(
  "/:id/approve-old",
  protect,
  authorize("manager", "finance", "admin"),
  approveTransaction,
);
router.post(
  "/:id/reject-old",
  protect,
  authorize("manager", "finance", "admin"),
  rejectTransaction,
);
router.post(
  "/:id/request-info",
  protect,
  authorize("approver", "admin"),
  requestAdditionalInfo,
);
router.post("/:id/pay", protect, authorize("finance", "admin"), markAsPaid);

module.exports = router;
