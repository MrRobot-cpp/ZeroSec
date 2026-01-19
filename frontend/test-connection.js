// Test script to verify frontend-backend connection
// Run with: node test-connection.js

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

async function testConnection() {
  console.log("🔍 Testing RAG Backend Connection...");
  console.log(`📡 API URL: ${API_URL}`);
  console.log("");

  try {
    // Test query
    const testQuestion = "What is ZeroSec?";
    console.log(`❓ Sending test question: "${testQuestion}"`);

    const response = await fetch(`${API_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: testQuestion }),
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error("❌ Request failed!");
      const errorText = await response.text();
      console.error("Error details:", errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log("✅ Connection successful!");
    console.log("");
    console.log("📦 Response data:");
    console.log(JSON.stringify(data, null, 2));
    console.log("");

    if (data.decision === "BLOCK") {
      console.log("⚠️  Query was blocked by firewall");
      console.log(`   Reason: ${data.reason}`);
    } else if (data.decision === "ALLOW") {
      console.log("✅ Query allowed");
      console.log(`   Answer: ${data.answer}`);
    }

    console.log("");
    console.log("🎉 Backend is working correctly!");

  } catch (error) {
    console.error("❌ Connection failed!");
    console.error("Error:", error.message);
    console.error("");
    console.error("Troubleshooting:");
    console.error("1. Make sure the backend is running: cd Backend && python app.py");
    console.error("2. Check if port 5200 is accessible");
    console.error("3. Verify CORS is enabled in the backend");
    console.error("4. Check firewall/antivirus settings");
    process.exit(1);
  }
}

testConnection();
