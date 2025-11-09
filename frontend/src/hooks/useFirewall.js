"use client";
import { useState, useEffect, useRef } from "react";

export default function useFirewall() {
  const [verdict, setVerdict] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_queries: 0, total_blocks: 0 });
  const sourceRef = useRef(null);

  // 🔥 Connect to SSE
  const connectSSE = () => {
    if (typeof window === "undefined") return; // ensure client-side
    const source = new EventSource("http://localhost:5200/stream");
    sourceRef.current = source;

    source.onmessage = (event) => {
      if (!event.data || event.data === "{}") return; // heartbeat
      try {
        const data = JSON.parse(event.data);
        if (!data.query) return;

        // Update logs
        setLogs((prev) => [{ ...data, id: Date.now() }, ...prev].slice(0, 200));

        // Update stats
        const total_queries = data.stats?.total_queries ?? stats.total_queries + 1;
        const total_blocks = data.stats?.total_blocks ?? stats.total_blocks + (data.decision !== "ALLOW" ? 1 : 0);
        setStats({ total_queries, total_blocks });

        // Update verdict
        const isBlocked = data.decision !== "ALLOW";
        const emoji = isBlocked ? "🚫" : "✅";
        const msg = isBlocked ? `Blocked: ${data.reason}` : `Passed: ${data.reason}`;
        setVerdict(isBlocked ? "blocked" : "safe");
        setResponseText(`${emoji} ${msg} — [${total_blocks}/${total_queries} blocked]`);
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    source.onerror = () => {
      console.warn("⚠️ Firewall SSE connection lost — reconnecting...");
      source.close();
      setTimeout(connectSSE, 3000);
    };
  };

  // 🔄 Setup SSE on mount
  useEffect(() => {
    connectSSE();
    return () => sourceRef.current?.close();
  }, []);

  // 🧠 Fetch old logs once on mount
  useEffect(() => {
    if (typeof window === "undefined") return; // client-side only
    (async () => {
      try {
        const res = await fetch("http://localhost:5200/logs", {
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setLogs(data.reverse().slice(0, 200));

        const total = data.length;
        const blocks = data.filter((l) => l.decision === "BLOCK" || l.decision === "QUARANTINE").length;
        setStats({ total_queries: total, total_blocks: blocks });
      } catch (err) {
        console.warn("⚠️ Could not load previous logs:", err);
      }
    })();
  }, []);

  return { verdict, responseText, logs, stats };
}
