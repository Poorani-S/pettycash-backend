require("dotenv").config();

console.log("\n🔍 Checking SendGrid API Key...\n");

const apiKey = process.env.SENDGRID_API_KEY;

console.log("API Key value:");
console.log(`"${apiKey}"`);
console.log("");
console.log("API Key length:", apiKey ? apiKey.length : 0);
console.log(
  "API Key starts with 'SG.':",
  apiKey ? apiKey.startsWith("SG.") : false,
);
console.log("Contains whitespace:", apiKey ? /\s/.test(apiKey) : false);
console.log("");

// Show first and last few characters
if (apiKey) {
  console.log("First 10 chars:", apiKey.substring(0, 10));
  console.log("Last 10 chars:", apiKey.substring(apiKey.length - 10));
}

console.log("\n📝 To generate a new API key:");
console.log("1. Go to: https://app.sendgrid.com/settings/api_keys");
console.log("2. Click 'Create API Key'");
console.log("3. Name: 'Kambaa Petty Cash'");
console.log(
  "4. Access: 'Full Access' or 'Restricted Access' with 'Mail Send' permission",
);
console.log("5. Copy the key and update .env file");
console.log("");
