const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  resendInvitation,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

router
  .route("/")
  .get(protect, authorize("admin", "manager", "approver"), getUsers)
  .post(protect, authorize("admin", "manager"), createUser);

router
  .route("/:id")
  .get(protect, authorize("admin", "manager", "approver"), getUser)
  .put(protect, authorize("admin", "manager"), updateUser)
  .delete(protect, authorize("admin", "manager"), deleteUser);

router.patch(
  "/:id/deactivate",
  protect,
  authorize("admin", "manager"),
  deactivateUser,
);
router.post(
  "/:id/resend-invitation",
  protect,
  authorize("admin", "manager"),
  resendInvitation,
);

module.exports = router;
