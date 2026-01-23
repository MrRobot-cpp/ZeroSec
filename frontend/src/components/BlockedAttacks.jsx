import PropTypes from "prop-types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function BlockedAttacks({ logs }) {
  // Filter for last 24 hours
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentLogs = logs.filter((l) => {
    const logTime = new Date(l.timestamp);
    return logTime >= last24h && l.decision?.toUpperCase() === "BLOCK";
  });

  // Count attack types and format names
  const attackCounts = {};
  recentLogs.forEach((l) => {
    let reason = l.reason || "Unknown";
    // Format the reason for better display
    reason = reason
      .replace(/_/g, " ")
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    attackCounts[reason] = (attackCounts[reason] || 0) + 1;
  });

  const pieData = Object.entries(attackCounts).map(([name, value]) => ({
    name,
    value,
  }));

  const COLORS = ["#ff4d4d", "#ff9100", "#ffea00", "#b388ff", "#2979ff", "#00e676", "#00e5ff"];

  const totalBlocked = recentLogs.length;

  return (
    <div className="h-full p-3 bg-gray-800 border border-gray-700 rounded-xl shadow flex flex-col overflow-hidden">
      <h2 className="text-base font-semibold mb-3 text-white text-center">Blocked Attacks (24h)</h2>

      {totalBlocked === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">✅</div>
            <p>No attacks in last 24h</p>
            <p className="text-xs mt-1">System is clean</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-center mb-3">
            <div className="text-4xl font-bold text-red-400">{totalBlocked}</div>
            <div className="text-sm text-gray-400">Threats Blocked</div>
          </div>

          <div className="space-y-2">
            {pieData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-700/30 border border-gray-600">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-300">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

BlockedAttacks.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      decision: PropTypes.string,
      reason: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ).isRequired,
};
