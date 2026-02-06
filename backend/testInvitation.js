// Test invitation email sending
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");

// Connect to MongoDB first
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB Connected..."))
  .catch((err) => console.error("MongoDB Error:", err));

const testInvitation = async () => {
  console.log("\n========== INVITATION EMAIL TEST ==========\n");

  try {
    // Try loading the notification service
    console.log("Loading notification service...");
    const notificationService = require("./services/notificationService");
    console.log("✅ Notification service loaded");
    console.log("Available functions:", Object.keys(notificationService));

    const { sendUserInvitation } = notificationService;

    if (!sendUserInvitation) {
      console.error("❌ sendUserInvitation function not found!");
      process.exit(1);
    }

    console.log("✅ sendUserInvitation function found");

    // Create a mock user object for testing
    const mockUser = {
      name: "Test User",
      email: "poorani372006@gmail.com", // Send to admin for testing
      role: "employee",
      approvalLimit: null,
    };

    console.log("\n--- Sending Invitation Email ---");
    console.log("To:", mockUser.email);
    console.log("Name:", mockUser.name);

    const result = await sendUserInvitation(mockUser);
    console.log("\nResult:", result);

    if (result.success) {
      console.log("\n✅ INVITATION EMAIL TEST PASSED!");
    } else {
      console.log("\n❌ INVITATION EMAIL TEST FAILED:", result.error);
    }
  } catch (error) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error.stack);
  }

  console.log("\n============================================\n");
  process.exit(0);
};

// Wait a moment for MongoDB connection
setTimeout(testInvitation, 2000);
