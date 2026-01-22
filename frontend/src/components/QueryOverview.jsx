import PropTypes from "prop-types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from "recharts";

export default function QueryOverview({ logs }) {
  const total = logs.length;
  const blocked = logs.filter((l) => l.decision?.toUpperCase() === "BLOCK").length;
  const allowed = logs.filter((l) => l.decision?.toUpperCase() === "ALLOW").length;

  const data = [
    { name: "Total", value: total, color: "#b388ff" },
    { name: "Allowed", value: allowed, color: "#00e676" },
    { name: "Blocked", value: blocked, color: "#ff4d4d" },
  ];

  return (
    <div className="h-full p-3 bg-gray-800 border border-gray-700 rounded-xl shadow flex flex-col justify-center">
      <h2 className="text-base font-semibold mb-3 text-white text-center">Query Overview</h2>

      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">📊</div>
            <p>No queries yet</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={data} margin={{ left: 0, right: 0 }}>
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px"
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                {data.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-3 gap-0 mt-2">
            <div className="text-center">
              <div className="text-2xl font-bold text-[#b388ff]">{total}</div>
              <div className="text-xs text-gray-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00e676]">{allowed}</div>
              <div className="text-xs text-gray-400">Allowed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#ff4d4d]">{blocked}</div>
              <div className="text-xs text-gray-400">Blocked</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

QueryOverview.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      decision: PropTypes.string,
    })
  ).isRequired,
};
