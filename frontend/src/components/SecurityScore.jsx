import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";

export default function SecurityScore({ logs }) {
  // Calculate security score based on block rate and attack patterns
  const total = logs.length || 1;
  const blocked = logs.filter((l) => l.decision?.toUpperCase() === "BLOCK").length;
  const blockRate = (blocked / total) * 100;

  // Score: Higher block rate = lower security score (more attacks)
  const rawScore = Math.max(0, 100 - blockRate);
  const score = Math.round(rawScore);

  // Determine score status
  const getScoreStatus = (score) => {
    if (score >= 80) return { label: "Excellent", color: "text-emerald-400", hex: "#34d399", glow: "rgba(52,211,153,0.4)" };
    if (score >= 60) return { label: "Good", color: "text-blue-400", hex: "#60a5fa", glow: "rgba(96,165,250,0.4)" };
    if (score >= 40) return { label: "Fair", color: "text-yellow-400", hex: "#facc15", glow: "rgba(250,204,21,0.4)" };
    if (score >= 20) return { label: "Poor", color: "text-orange-400", hex: "#fb923c", glow: "rgba(251,146,60,0.4)" };
    return { label: "Critical", color: "text-rose-400", hex: "#fb7185", glow: "rgba(251,113,133,0.4)" };
  };

  const status = getScoreStatus(score);
  
  // Animation state for SVG ring
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setProgress(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="h-full p-5 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden group transition-all duration-500 hover:border-gray-700 min-h-0">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 blur-[80px] rounded-full pointer-events-none transition-opacity duration-1000 opacity-20" style={{ backgroundColor: status.hex }}></div>

      <h2 className="text-lg font-semibold mb-2 text-gray-100 relative z-10 flex items-center justify-between">
        Security Score
        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border border-gray-700/50 bg-gray-900/50 ${status.color}`}>
          {status.label}
        </span>
      </h2>

      <div className="flex-1 flex flex-col items-center justify-between relative z-10 min-h-0">
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="relative w-48 h-48 flex items-center justify-center group-hover:scale-105 transition-transform duration-500">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              {/* Background circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#1f2937"
                strokeWidth="10"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={status.hex}
                strokeWidth="10"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{ filter: `drop-shadow(0 0 10px ${status.glow})` }}
              />
            </svg>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className={`text-6xl font-bold tracking-tighter ${status.color}`} style={{ textShadow: `0 0 20px ${status.glow}` }}>
                {score}
              </div>
              <div className="text-sm text-gray-500 font-medium tracking-wide">/ 100</div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 w-full mt-2">
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border border-gray-800/80 text-center transition-colors hover:bg-gray-800/80">
            <div className="text-xs text-gray-500 font-medium uppercase mb-1">Total</div>
            <div className="text-lg font-bold text-gray-200">{total}</div>
          </div>
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border border-gray-800/80 text-center transition-colors hover:bg-rose-900/10 hover:border-rose-900/30">
            <div className="text-xs text-gray-500 font-medium uppercase mb-1">Blocked</div>
            <div className="text-lg font-bold text-rose-400">{blocked}</div>
          </div>
          <div className="bg-gray-900/60 backdrop-blur-sm rounded-xl p-3 border border-gray-800/80 text-center transition-colors hover:bg-gray-800/80">
            <div className="text-xs text-gray-500 font-medium uppercase mb-1">Rate</div>
            <div className="text-lg font-bold text-gray-300">{blockRate.toFixed(1)}%</div>
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
