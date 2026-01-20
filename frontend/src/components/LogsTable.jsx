import React from "react";
import PropTypes from "prop-types";

export default function LogsTable({ logs }) {
  const truncate = (str, max = 100) => (str.length > max ? str.slice(0, max) + "..." : str);

  return (
    <div className="col-span-3 bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
      <h2 className="text-lg font-semibold mb-4 text-white">Traffic / Logs</h2>
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
              logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-700">
                  <td className="py-2 text-gray-100">{truncate(log.query)}</td>
                  <td className="py-2 text-sm text-gray-100">{log.score}</td>
                  <td className="py-2 text-sm text-gray-100">{log.timestamp}</td>
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
                  <td className="py-2 text-gray-100">{log.reason || "-"}</td>
                  <td className="py-2 text-sm text-gray-100">{log.stopped_by || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

LogsTable.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      query: PropTypes.string,
      score: PropTypes.number,
      timestamp: PropTypes.string,
      decision: PropTypes.string,
      reason: PropTypes.string,
      stopped_by: PropTypes.string,
    })
  ).isRequired,
};
