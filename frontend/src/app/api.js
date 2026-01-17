let logs = [];

/**
 * Handle POST /api/firewall
 * Sends a query to the Python firewall backend and stores the result.
 */
export async function POST(req) {
  try {
    const { query } = await req.json();
    if (!query) {
      return new Response(
        JSON.stringify({ decision: "ERROR", reason: "Missing query" }),
        { status: 400 }
      );
    }

    const response = await fetch("http://127.0.0.1:5200/inspect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunk: query }),
    });

    const result = await response.json();

    logs.unshift({
      id: Date.now(),
      time: new Date().toISOString(),
      query,
      ...result,
    });

    return new Response(JSON.stringify(result), { status: 200 });
  } catch (error) {
    console.error("❌ Firewall API error:", error);
    return new Response(
      JSON.stringify({ decision: "ERROR", reason: "Backend unreachable" }),
      { status: 500 }
    );
  }
}

/**
 * Handle GET /api/firewall
 * Returns all locally stored logs (fallback)
 */
export async function GET() {
  return new Response(JSON.stringify(logs), { status: 200 });
}
