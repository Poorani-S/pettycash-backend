const axios = require("axios");
const fs = require("fs");

async function testPDFExport() {
  try {
    console.log("🧪 Testing PDF Export...\n");

    // Login first
    console.log("1️⃣ Logging in as admin...");
    const loginRes = await axios.post("http://localhost:5000/api/auth/login", {
      email: "poorani372006@gmail.com",
      password: "admin123",
    });

    const token = loginRes.data.data.token;
    console.log("✅ Login successful\n");

    const headers = { Authorization: `Bearer ${token}` };

    // Test PDF Export
    console.log("2️⃣ Testing PDF Export...");
    try {
      const pdfRes = await axios.get(
        "http://localhost:5000/api/reports/export/pdf",
        {
          headers,
          params: {
            period: "all",
          },
          responseType: "arraybuffer",
        },
      );

      // Save the PDF to check it
      const pdfPath = "./test-export.pdf";
      fs.writeFileSync(pdfPath, pdfRes.data);
      console.log(`✅ PDF exported successfully: ${pdfPath}`);
      console.log(
        `   File size: ${(pdfRes.data.length / 1024).toFixed(2)} KB\n`,
      );
    } catch (err) {
      console.log(
        "❌ PDF export failed:",
        err.response?.data || err.message,
        "\n",
      );
    }

    // Test User Activity PDF Export
    console.log("3️⃣ Testing User Activity PDF Export...");
    try {
      const activityPdfRes = await axios.get(
        "http://localhost:5000/api/user-activity/export/pdf",
        {
          headers,
          responseType: "arraybuffer",
        },
      );

      // Save the PDF to check it
      const activityPdfPath = "./test-user-activity.pdf";
      fs.writeFileSync(activityPdfPath, activityPdfRes.data);
      console.log(
        `✅ User Activity PDF exported successfully: ${activityPdfPath}`,
      );
      console.log(
        `   File size: ${(activityPdfRes.data.length / 1024).toFixed(2)} KB\n`,
      );
    } catch (err) {
      console.log(
        "❌ User Activity PDF export failed:",
        err.response?.data || err.message,
        "\n",
      );
    }

    console.log("✅ All PDF tests completed!");
  } catch (error) {
    console.error("❌ Test error:", error.message);
    console.error("Stack:", error.stack);
  }
}

testPDFExport();
