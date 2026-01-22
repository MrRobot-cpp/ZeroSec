import PropTypes from "prop-types";

export default function SecurityScore({ logs }) {
  // Calculate security score based on block rate and attack patterns
  const total = logs.length || 1;
  const blocked = logs.filter((l) => l.decision?.toUpperCase() === "BLOCK").length;
  const blockRate = (blocked / total) * 100;

  // Score: Higher block rate = lower security score (more attacks)
  // Inverse relationship: 0% blocks = 100 score, 100% blocks = 0 score
  const rawScore = Math.max(0, 100 - blockRate);
  const score = Math.round(rawScore);

  // Determine score status
  const getScoreStatus = (score) => {
    if (score >= 80) return { label: "Excellent", color: "text-green-400", bg: "bg-green-900/30", border: "border-green-400" };
    if (score >= 60) return { label: "Good", color: "text-blue-400", bg: "bg-blue-900/30", border: "border-blue-400" };
    if (score >= 40) return { label: "Fair", color: "text-yellow-400", bg: "bg-yellow-900/30", border: "border-yellow-400" };
    if (score >= 20) return { label: "Poor", color: "text-orange-400", bg: "bg-orange-900/30", border: "border-orange-400" };
    return { label: "Critical", color: "text-red-400", bg: "bg-red-900/30", border: "border-red-400" };
  };

  const status = getScoreStatus(score);

  return (
    <div className={`h-full p-3 bg-gray-800 border ${status.border} rounded-xl shadow flex flex-col`}>
      <h2 className="text-base font-semibold mb-3 text-white text-center">Security Score</h2>

      <div className="flex-1 flex flex-col justify-center">
        <div className="flex items-center justify-center mb-3">
        <div className={`relative w-36 h-36 rounded-full ${status.bg} border-4 ${status.border} flex items-center justify-center`}>
          <div className="text-center">
            <div className={`text-5xl font-bold ${status.color}`}>{score}</div>
            <div className="text-base text-gray-400">/ 100</div>
          </div>
        </div>
      </div>

        <div className="text-center mb-3">
          <span className={`text-lg font-semibold ${status.color}`}>{status.label}</span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Total Queries:</span>
            <span className="text-white font-semibold">{total}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Blocked:</span>
            <span className="text-red-400 font-semibold">{blocked}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Block Rate:</span>
            <span className="text-white font-semibold">{blockRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

SecurityScore.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      decision: PropTypes.string,
    })
  ).isRequired,
};
