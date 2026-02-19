require("dotenv").config();

const mongoose = require("mongoose");
const User = require("../models/User");

async function main() {
  if (!process.env.MONGODB_URI) {
    console.log("No MONGODB_URI set");
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const users = await User.find({}).select("name email role managerId").lean();
  console.log(
    users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      role: u.role,
      managerId: u.managerId ? String(u.managerId) : null,
    })),
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
