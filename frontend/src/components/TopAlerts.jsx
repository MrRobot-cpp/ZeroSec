"use client";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import apiClient from "@/services/apiClient";

// Classify a log entry into an alert category
function classifyAlert(log) {
  const reason     = (log.reason || "").toLowerCase();
  const stoppedBy  = (log.stopped_by || "").toLowerCase();
  const isAnomaly  = log.is_anomaly === true || stoppedBy.includes("anomaly");

  if (isAnomaly)                                                  return "anomaly";
  if (reason.includes("injection") || reason.includes("jailbreak")) return "jailbreak";
  if (reason.includes("pii") || reason.includes("leak"))           return "leak";
  if (reason.includes("canary"))                                   return "canary";
  return "other";
}

const CATEGORY_STYLE = {
  anomaly:  { border: "border-violet-500/30", bg: "bg-violet-900/10", text: "text-violet-400", dot: "bg-violet-500", glow: "shadow-[0_0_8px_rgba(139,92,246,0.5)]" },
  jailbreak:{ border: "border-rose-500/30", bg: "bg-rose-900/10", text: "text-rose-400", dot: "bg-rose-500", glow: "shadow-[0_0_8px_rgba(244,63,94,0.5)]" },
  leak:     { border: "border-orange-500/30", bg: "bg-orange-900/10", text: "text-orange-400", dot: "bg-orange-500", glow: "shadow-[0_0_8px_rgba(249,115,22,0.5)]" },
  canary:   { border: "border-yellow-500/30", bg: "bg-yellow-900/10", text: "text-yellow-400", dot: "bg-yellow-500", glow: "shadow-[0_0_8px_rgba(234,179,8,0.5)]" },
  other:    { border: "border-gray-500/30", bg: "bg-gray-800/30", text: "text-gray-400", dot: "bg-gray-500", glow: "shadow-[0_0_8px_rgba(107,114,128,0.5)]" },
};

const CATEGORY_LABEL = {
  anomaly:  "ML Anomaly",
  jailbreak:"Jailbreak",
  leak:     "Data Leak",
  canary:   "Canary Trigger",
  other:    "Alert",
};

const truncate = (str, max = 48) =>
  str?.length > max ? str.slice(0, max) + "…" : str || "";

export default function TopAlerts({ logs }) {
  const [modelReady, setModelReady] = useState(null); // null = loading

  // Fetch anomaly model status once on mount
  useEffect(() => {
    apiClient
      .get("/api/anomaly/status")
      .then((res) => res.ok && res.json())
      .then((data) => data && setModelReady(Boolean(data.model_ready)))
      .catch(() => setModelReady(false));
  }, []);

  // Top 5 most recent blocked entries (BLOCK decision or ML anomaly)
  const alertLogs = logs
    .filter((l) => l.decision?.toUpperCase() === "BLOCK" || l.is_anomaly === true)
    .slice(0, 5);

  return (
    <div className="h-full p-5 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden group transition-all duration-500 hover:border-gray-700 min-h-0">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/5 blur-[60px] rounded-full pointer-events-none transition-opacity duration-1000"></div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <h2 className="text-lg font-semibold text-gray-100 tracking-tight flex items-center gap-2">
          Top Alerts
        </h2>
        {/* ML model status pill */}
        {modelReady !== null && <ModelStatusPill active={modelReady} />}
      </div>

      {alertLogs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-3xl mb-3 opacity-50">🛡️</div>
            <p className="font-medium text-gray-400">No security alerts</p>
            <p className="text-xs mt-1 text-gray-600">System is secure</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 custom-scrollbar relative z-10">
          {alertLogs.map((log, idx) => {
            const cat   = classifyAlert(log);
            const style = CATEGORY_STYLE[cat];
            const label = CATEGORY_LABEL[cat];
            const score = typeof log.anomaly_score === "number" ? log.anomaly_score : null;
            const key = log.id != null
              ? `db-${log.id}-${idx}`
              : `fw-${log.timestamp || idx}-${(log.query || "").slice(0, 20)}-${idx}`;

            return (
              <div
                key={key}
                className={`p-3 rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
              >
                <div className="flex justify-between items-start mb-1.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full ${style.dot} ${style.glow}`}></span>
                    <span className={`text-xs font-bold tracking-wider uppercase ${style.text}`}>{label}</span>
                    {/* ML score badge */}
                    {score !== null && (
                      <span className="text-[10px] font-mono bg-violet-900/40 text-violet-300 border border-violet-700/50 px-1.5 py-0.5 rounded-md">
                        {score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium shrink-0 bg-gray-900/50 px-1.5 py-0.5 rounded border border-gray-800">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-200 truncate font-medium">
                  {truncate(log.query, 60)}
                </p>
                {log.reason && (
                  <p className="text-[10px] text-gray-500 mt-1 truncate">
                    ↳ {truncate(log.reason, 60)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Custom Scrollbar Styles for this component */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}} />
    </div>
  );
}

function ModelStatusPill({ active }) {
  if (active) {
    return (
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2 py-1 rounded-md backdrop-blur-sm shadow-[0_0_10px_rgba(139,92,246,0.1)]">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block shadow-[0_0_5px_rgba(139,92,246,0.8)]"></span>
        <span>ML Active</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-gray-500 bg-gray-800/50 border border-gray-700/50 px-2 py-1 rounded-md">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block"></span>
      <span>ML Inactive</span>
    </span>
  );
}

ModelStatusPill.propTypes = {
  active: PropTypes.bool.isRequired,
};

TopAlerts.propTypes = {
  logs: PropTypes.arrayOf(
    PropTypes.shape({
      id:            PropTypes.number,
      query:         PropTypes.string,
      decision:      PropTypes.string,
      reason:        PropTypes.string,
      timestamp:     PropTypes.string,
      stopped_by:    PropTypes.string,
      is_anomaly:    PropTypes.bool,
      anomaly_score: PropTypes.number,
    })
  ).isRequired,
};
