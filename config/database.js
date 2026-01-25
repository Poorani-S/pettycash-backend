const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Check if MongoDB URI is provided
    if (!process.env.MONGODB_URI) {
      console.warn("⚠️  MongoDB URI not provided. Running in API-only mode.");
      console.warn(
        "⚠️  Database features will be limited. Please configure MongoDB to enable full functionality.",
      );
      return;
    }

    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn(
      "⚠️  Continuing without database. Please install MongoDB or use MongoDB Atlas.",
    );
    console.warn(
      "⚠️  Visit: https://www.mongodb.com/try/download/community for local installation",
    );
    console.warn(
      "⚠️  Or use MongoDB Atlas: https://www.mongodb.com/cloud/atlas",
    );
  }
};

module.exports = connectDB;
