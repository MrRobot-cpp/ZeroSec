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
      if (!event.data || event.data.startsWith(":")) return; // ignore heartbeats/comments
      try {
        const data = JSON.parse(event.data);
        if (!data.query) return;

        // Update logs (keep latest 200)
        setLogs((prev) => [{ ...data, id: Date.now() }, ...prev].slice(0, 200));

        // Update stats
        setStats((prev) => {
          const total_queries = prev.total_queries + 1;
          const total_blocks =
            prev.total_blocks + (data.decision !== "ALLOW" ? 1 : 0);
          return { total_queries, total_blocks };
        });

        // Update verdict & message
        setVerdict(data.decision !== "ALLOW" ? "blocked" : "safe");
        const emoji = data.decision !== "ALLOW" ? "🚫" : "✅";
        const msg =
          data.decision !== "ALLOW"
            ? `Blocked: ${data.reason || "unknown"}`
            : "Passed firewall checks";

        // Update responseText using latest stats
        setResponseText((prev) => {
          const total = stats.total_queries + 1; // estimate next total
          const blocked =
            stats.total_blocks +
            (data.decision !== "ALLOW" ? 1 : 0); // estimate next blocked
          return `${emoji} ${msg} — [${blocked}/${total} blocked]`;
        });
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
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Old logs in reverse order (latest first)
        const latestLogs = data.reverse().slice(0, 200);
        setLogs(latestLogs);

        const total = latestLogs.length;
        const blocks = latestLogs.filter(
          (l) => l.decision === "BLOCK" || l.decision === "QUARANTINE"
        ).length;
        setStats({ total_queries: total, total_blocks: blocks });
      } catch (err) {
        console.warn("⚠️ Could not load previous logs:", err);
      }
    })();
  }, []);

  return { verdict, responseText, logs, stats };
}
