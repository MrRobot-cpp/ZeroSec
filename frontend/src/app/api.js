export async function POST(req) {
  try {
    const { query } = await req.json();

    // Send it to your Python backend
    const response = await fetch("http://localhost:5000/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunk: query }),
    });

    const result = await response.json();
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error("Error calling firewall:", error);
    return new Response(JSON.stringify({ decision: "ERROR", reason: "Backend unreachable" }), { status: 500 });
  }
}
let logs = [];

export async function POST(req) {
  const data = await req.json();
  logs.unshift({ time: new Date().toLocaleString(), ...data });
  return new Response("OK");
}

export async function GET() {
  return new Response(JSON.stringify(logs), { status: 200 });
}
