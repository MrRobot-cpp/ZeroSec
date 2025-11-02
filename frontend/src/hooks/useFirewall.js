"use client";
import { useState, useEffect, useRef } from "react";

export default function useFirewall() {
  const [verdict, setVerdict] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_queries: 0, total_blocks: 0 });
  const eventSourceRef = useRef(null);

  // ✅ Load past logs once at startup
  useEffect(() => {
    async function fetchOldLogs() {
      try {
        const res = await fetch("http://localhost:5000/logs");
        if (res.ok) {
          const data = await res.json();
          setLogs(data.reverse());
          const total = data.length;
          const blocks = data.filter((l) => l.decision === "BLOCK").length;
          setStats({ total_queries: total, total_blocks: blocks });
        }
      } catch (err) {
        console.warn("⚠️ Could not load previous logs:", err);
      }
    }
    fetchOldLogs();
  }, []);

  // 🔥 Live updates via SSE
  useEffect(() => {
    const source = new EventSource("http://localhost:5000/stream");
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      const data = JSON.parse(event.data); // { query, decision, reason, time }

      setLogs((prev) => [{ ...data, id: Date.now() }, ...prev].slice(0, 100));

        // Use backend stats directly (for perfect sync)
        setStats(data.stats || { total_queries: 0, total_blocks: 0 });

        // Verdict + message
        const isBlocked = data.decision === "BLOCK";
        setVerdict(isBlocked ? "blocked" : "safe");
        const emoji = isBlocked ? "🚫" : "✅";
        const msg = isBlocked
          ? `⚠️ Blocked: ${data.reason}`
          : `✅ Passed Firewall: ${data.reason}`;

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
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        eventSourceRef.current = new EventSource("http://localhost:5000/stream");
      }, 3000);
    };

    return () => source.close();
  }, []);

  return { verdict, responseText, logs, stats };
}
