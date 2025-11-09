// src/components/LogsTable.jsx
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

export default function LogsTable() {
  const [logs, setLogs] = useState([]);

  // Fetch previous logs on mount
  useEffect(() => {
    fetch("http://localhost:5200/logs")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setLogs(data))
      .catch((err) => console.error("Could not load previous logs:", err));
  }, []);

  // Subscribe to SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource("http://localhost:5200/stream");

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        setLogs((prevLogs) => [log, ...prevLogs]);
      } catch (err) {
        console.error("Failed to parse SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE connection error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  // Limit long queries for display
  const truncate = (str, max = 100) =>
    str.length > max ? str.slice(0, max) + "..." : str;

  return (
    <div className="col-span-3 bg-neutral-900 p-6 rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-4">Traffic / Logs</h2>
      <div className="overflow-auto max-h-64">
        <table className="min-w-full text-left">
          <thead>
            <tr className="text-sm text-gray-400">
              <th className="py-2">Query</th>
              <th>Score</th>
              <th>Timestamp</th>
              <th>Decision</th>
              <th>Reason</th>
              <th>Stopped By</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-gray-400">
                  No logs yet — send a query to populate this table.
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr key={idx} className="border-t border-neutral-950">
                  <td className="py-2">{truncate(log.query)}</td>
                  <td className="py-2 text-sm text-gray-300">{log.score}</td>
                  <td className="py-2 text-sm text-gray-300">{log.timestamp}</td>
                  <td
                    className={`py-2 font-semibold ${
                      log.decision === "BLOCK"
                        ? "text-red-400"
                        : log.decision === "ALLOW"
                        ? "text-green-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {log.decision}
                  </td>
                  <td className="py-2">{log.reason || "-"}</td>
                  <td className="py-2 text-sm text-gray-300">
                    {log.stopped_by || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Prop validation
LogsTable.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      query: PropTypes.string,
      score: PropTypes.number,
      timestamp: PropTypes.string,
      decision: PropTypes.string,
      reason: PropTypes.string,
      stopped_by: PropTypes.string,
    })
  ),
};
