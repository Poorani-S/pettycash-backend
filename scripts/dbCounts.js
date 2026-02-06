require("dotenv").config();

const mongoose = require("mongoose");
const Transaction = require("../models/Transaction");
const FundTransfer = require("../models/FundTransfer");

async function main() {
  if (!process.env.MONGODB_URI) {
    console.log("No MONGODB_URI set");
    process.exit(0);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const [transactions, fundTransfers] = await Promise.all([
    Transaction.countDocuments(),
    FundTransfer.countDocuments(),
  ]);

  console.log(JSON.stringify({ transactions, fundTransfers }, null, 2));
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
