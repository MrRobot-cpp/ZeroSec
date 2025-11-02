let logs = [];

// --- Send query to Python Firewall ---
export async function POST(req) {
try {
    const { query } = await req.json();

<<<<<<< Updated upstream
    // Send it to your Python backend
    const response = await fetch("http://localhost:5000/inspect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunk: query }),
=======
    const response = await fetch("http://127.0.0.1:5000/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunk: query }),
>>>>>>> Stashed changes
    });

    const result = await response.json();
    logs.unshift({ time: new Date().toISOString(), ...result });

    return new Response(JSON.stringify(result), { status: 200 });
} catch (error) {
    console.error("Error calling firewall:", error);
    return new Response(JSON.stringify({ decision: "ERROR", reason: "Backend unreachable" }), { status: 500 });
}
}
<<<<<<< Updated upstream
let logs = [];

export async function POST_LOG(req) {
const data = await req.json();
logs.unshift({ time: new Date().toLocaleString(), ...data });
return new Response("OK");
}
=======
>>>>>>> Stashed changes

// --- Allow dashboard to fetch logs manually (optional fallback) ---
export async function GET() {
return new Response(JSON.stringify(logs), { status: 200 });
}
