import PropTypes from "prop-types";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

export default function MetricsCharts({ logs }) {
  // ===== BASIC METRICS =====
  const total = logs.length;
  const blocked = logs.filter((l) => l.decision?.toUpperCase() === "BLOCK").length;
  const allowed = logs.filter((l) => l.decision?.toUpperCase() === "ALLOW").length;

  // ===== ATTACK TYPES =====
  const attackCounts = {};
  logs.forEach((l) => {
    if (l.reason) {
      attackCounts[l.reason] = (attackCounts[l.reason] || 0) + 1;
    }
  });

  const attackPieData = Object.entries(attackCounts).map(([name, value]) => ({
    name,
    value,
  }));

  // ===== VERDICT BAR DATA =====
  const verdictBarData = [
    { name: "Total", value: total },
    { name: "Blocked", value: blocked },
    { name: "Allowed", value: allowed },
  ];

  // ===== SCORE OVER TIME (LINE CHART) =====
  const scoreLineData = logs
    .filter((l) => typeof l.score === "number")
    .map((l, i) => ({
      index: i + 1,
      score: l.score,
      timestamp: l.timestamp,
    }));

  // Bright color palette
  const COLORS = ["#b388ff","#ff4d4d", "#00e676", "#2979ff", "#ffea00", "#ff9100", "#00e5ff"];

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* ===== BAR CHART (Total / Blocked / Allowed) ===== */}
      <div className="p-4 border rounded-2xl shadow">
        <h2 className="text-xl mb-4 font-semibold">Firewall Verdicts</h2>
        <BarChart width={350} height={300} data={verdictBarData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value">
            {verdictBarData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
         <p className="text-sm text-white-500 mt-3">
          Shows total requests analyzed and how many were blocked or allowed. Quick insight into firewall decision .
        </p>
      </div>

      {/* ===== PIE CHART (Attack Types Detected) ===== */}
      <div className="p-4 border rounded-2xl shadow">
        <h2 className="text-xl mb-4 font-semibold">Attack Types</h2>
        {attackPieData.length > 0 ? (
          <PieChart width={320} height={320}>
            <Pie
              data={attackPieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {attackPieData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : (
          <p className="text-gray-500 text-center mt-10">No attack data yet</p>
        )}
         <p className="text-sm text-white-500 mt-3">
          Visualizes detected attack types, helping identify which threat categories occur most frequently.
        </p>
      </div>

      {/* ===== LINE CHART (Risk Score Over Time) ===== */}
      <div className="p-4 border rounded-2xl shadow">
        <h2 className="text-xl mb-4 font-semibold">Risk Score Over Time</h2>
        <LineChart width={350} height={300} data={scoreLineData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="index" />
          <YAxis />
          <Tooltip
            labelFormatter={(i) =>
              scoreLineData[i] ? scoreLineData[i].timestamp : ""
            }
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#ff9100"
            strokeWidth={3}
            dot={{ r: 5, fill: "#ff9100" }}
            activeDot={{ r: 8 }}
          />
        </LineChart>
         <p className="text-sm text-white-500 mt-3">
            Tracks risk scores over time to reveal trends in detection intensity and model response consistency.
        </p>
      </div>
    </div>
  );
}

MetricsCharts.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      decision: PropTypes.string,
      reason: PropTypes.string,
      timestamp: PropTypes.string,
      score: PropTypes.number,
    })
  ).isRequired,
};
