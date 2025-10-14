"use client";
import { useState, useEffect } from "react";

export default function useFirewall() {
  const [verdict, setVerdict] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [logs, setLogs] = useState([]);

  // 🔥 Listen only — no sending
  useEffect(() => {
    const source = new EventSource("http://localhost:5000/stream");

    source.onmessage = (event) => {
      const data = JSON.parse(event.data); // { query, decision, reason, time }

      setLogs((prev) => [{ ...data, id: Date.now() }, ...prev].slice(0, 100));

      setVerdict(data.decision === "BLOCK" ? "blocked" : "safe");
      setResponseText(
        data.decision === "BLOCK"
          ? `⚠️ Blocked: ${data.reason}`
          : "✅ Passed Firewall."
      );
    };

    source.onerror = () => {
      console.warn("SSE connection lost");
      source.close();
    };

    return () => source.close();
  }, []);

  return { verdict, responseText, logs };
}
