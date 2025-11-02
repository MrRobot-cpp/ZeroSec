"use client";
import { useState, useEffect, useRef } from "react";

export default function useFirewall() {
  const [verdict, setVerdict] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_queries: 0, total_blocks: 0 });
  const sourceRef = useRef(null);

  // 🔥 Connect to live stream immediately
  useEffect(() => {
    const source = new EventSource("http://localhost:5000/stream");
    sourceRef.current = source;

    source.onmessage = (event) => {
      if (!event.data || event.data === "{}") return; // heartbeat
      try {
        const data = JSON.parse(event.data);
        if (!data.query) return;

        setLogs((prev) => [{ ...data, id: Date.now() }, ...prev].slice(0, 200));
        setStats(data.stats || { total_queries: 0, total_blocks: 0 });

        const isBlocked = data.decision !== "ALLOW";
        const emoji = isBlocked ? "🚫" : "✅";
        const msg = isBlocked
          ? `⚠️ Blocked: ${data.reason}`
          : `✅ Passed Firewall: ${data.reason}`;
        setVerdict(isBlocked ? "blocked" : "safe");
        setResponseText(
          `${emoji} ${msg} — [${data.stats.total_blocks}/${data.stats.total_queries} blocked]`
        );
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    source.onerror = () => {
      console.warn("⚠️ Firewall SSE connection lost — reconnecting...");
      source.close();
      setTimeout(() => {
        sourceRef.current = new EventSource("http://localhost:5000/stream");
      }, 3000);
    };

    return () => source.close();
  }, []);

  // 🧠 Fetch old logs (after SSE starts)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("http://localhost:5000/logs");
        if (!res.ok) return;
        const data = await res.json();
        setLogs((prev) => [...data.reverse(), ...prev].slice(0, 200));
        const total = data.length;
        const blocks = data.filter(
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
