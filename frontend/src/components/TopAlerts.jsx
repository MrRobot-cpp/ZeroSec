import PropTypes from "prop-types";

export default function TopAlerts({ logs }) {
  // Get top 5 most recent blocked queries
  const blockedLogs = logs
    .filter((l) => l.decision?.toUpperCase() === "BLOCK")
    .slice(0, 5);

  const getSeverityColor = (reason) => {
    const lowerReason = reason?.toLowerCase() || "";
    if (lowerReason.includes("injection") || lowerReason.includes("jailbreak")) {
      return "text-red-400 bg-red-900/30 border-red-400";
    }
    if (lowerReason.includes("pii") || lowerReason.includes("leak")) {
      return "text-orange-400 bg-orange-900/30 border-orange-400";
    }
    if (lowerReason.includes("exfil")) {
      return "text-yellow-400 bg-yellow-900/30 border-yellow-400";
    }
    return "text-gray-400 bg-gray-700/30 border-gray-500";
  };

  const truncate = (str, max = 60) => (str?.length > max ? str.slice(0, max) + "..." : str);

  return (
    <div className="h-full p-3 bg-gray-800 border border-gray-700 rounded-xl shadow flex flex-col overflow-hidden justify-center">
      <h2 className="text-base font-semibold mb-3 text-white text-center">Top 5 Alerts</h2>

      {blockedLogs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🛡️</div>
            <p>No security alerts</p>
            <p className="text-xs mt-1">System is secure</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-auto">
          {blockedLogs.map((log, idx) => (
            <div
              key={log.id || idx}
              className={`p-2 rounded-lg border ${getSeverityColor(log.reason)}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-semibold">
                  {log.reason || "Unknown Threat"}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-xs text-gray-300">
                {truncate(log.query, 40)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

TopAlerts.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      query: PropTypes.string,
      decision: PropTypes.string,
      reason: PropTypes.string,
      timestamp: PropTypes.string,
      stopped_by: PropTypes.string,
    })
  ).isRequired,
};
