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
  anomaly:  "text-violet-300 bg-violet-900/30 border-violet-500",
  jailbreak:"text-red-300    bg-red-900/30    border-red-400",
  leak:     "text-orange-300 bg-orange-900/30 border-orange-400",
  canary:   "text-yellow-300 bg-yellow-900/30 border-yellow-400",
  other:    "text-gray-300   bg-gray-700/30   border-gray-500",
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
    <div className="h-full p-3 bg-gray-800 border border-gray-700 rounded-xl shadow flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-white">Top 5 Alerts</h2>
        {/* ML model status pill */}
        {modelReady !== null && <ModelStatusPill active={modelReady} />}
      </div>

      {alertLogs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🛡️</div>
            <p>No security alerts</p>
            <p className="text-xs mt-1">System is secure</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-auto">
          {alertLogs.map((log, idx) => {
            const cat   = classifyAlert(log);
            const style = CATEGORY_STYLE[cat];
            const label = CATEGORY_LABEL[cat];
            const score = typeof log.anomaly_score === "number" ? log.anomaly_score : null;
            // Build a stable unique key: prefer DB id, fall back to timestamp+query
            // Never use idx alone — it causes key collisions on re-render
            const key = log.id != null
              ? `db-${log.id}`
              : `fw-${log.timestamp || idx}-${(log.query || "").slice(0, 20)}`;

            return (
              <div
                key={key}
                className={`p-2 rounded-lg border ${style}`}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold shrink-0">{label}</span>
                    {/* ML score badge — only on anomaly entries */}
                    {score !== null && (
                      <span className="text-xs font-mono bg-violet-900/50 text-violet-300 border border-violet-700/40 px-1.5 py-0 rounded">
                        {score.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleTimeString()
                      : ""}
                  </span>
                </div>
                <p className="text-xs text-gray-300 truncate">
                  {truncate(log.query, 52)}
                </p>
                {log.reason && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {truncate(log.reason, 52)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelStatusPill({ active }) {
  if (active) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block"></span>
        <span>ML active</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-700/50 border border-gray-600 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block"></span>
      <span>ML inactive</span>
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
