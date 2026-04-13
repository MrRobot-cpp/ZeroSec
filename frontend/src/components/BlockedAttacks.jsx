import PropTypes from "prop-types";

// Color map: ML Anomaly gets violet, rest cycle through threat colors
const CATEGORY_COLORS = {
  "ML Anomaly": "#a78bfa",
};
const FALLBACK_COLORS = ["#ff4d4d", "#ff9100", "#ffea00", "#2979ff", "#00e676", "#00e5ff"];

export default function BlockedAttacks({ logs }) {
  const now     = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const recentLogs = logs.filter((l) => {
    const logTime = new Date(l.timestamp);
    return logTime >= last24h && l.decision?.toUpperCase() === "BLOCK";
  });

  // Group by attack category
  const attackCounts = {};
  recentLogs.forEach((l) => {
    let category;
    if (l.is_anomaly || (l.stopped_by || "").toLowerCase().includes("anomaly")) {
      category = "ML Anomaly";
    } else {
      category = (l.reason || "Unknown")
        .replaceAll("_", " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    attackCounts[category] = (attackCounts[category] || 0) + 1;
  });

  // Sort: ML Anomaly first, then by count descending
  const entries = Object.entries(attackCounts).sort(([aName, aVal], [bName, bVal]) => {
    if (aName === "ML Anomaly") return -1;
    if (bName === "ML Anomaly") return 1;
    return bVal - aVal;
  });

  let fallbackIdx = 0;
  const getColor = (name) => {
    if (CATEGORY_COLORS[name]) return CATEGORY_COLORS[name];
    return FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
  };

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
            {entries.map(([name, count]) => {
              const color = getColor(name);
              return (
                <div
                  key={name}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-700/30 border border-gray-600"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm text-gray-300 truncate">{name}</span>
                  </div>
                  <span className="text-sm font-semibold text-white ml-2">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

BlockedAttacks.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      decision:   PropTypes.string,
      reason:     PropTypes.string,
      timestamp:  PropTypes.string,
      stopped_by: PropTypes.string,
      is_anomaly: PropTypes.bool,
    })
  ).isRequired,
};
