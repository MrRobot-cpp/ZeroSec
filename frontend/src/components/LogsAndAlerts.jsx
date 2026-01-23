"use client";

import { useState } from "react";
import useLogs from "@/hooks/useLogs";
import LogsTab from "./LogsTab";
import AlertsTab from "./AlertsTab";

export default function LogsAndAlerts() {
  const [activeTab, setActiveTab] = useState("logs");
  const logsData = useLogs();

  const tabs = [
    { id: "logs", label: "Logs", icon: "📋" },
    { id: "alerts", label: "Alerts", icon: "🚨" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Logs & Alerts</h1>
          <p className="text-gray-400 mt-1">
            Monitor system logs and security alerts in real-time
          </p>
        </div>

        <button
          onClick={logsData.refreshLogs}
          disabled={logsData.loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {logsData.loading ? (
            <>
              <span className="animate-spin">⟳</span>
              Refreshing...
            </>
          ) : (
            <>
              <span>🔄</span>
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {logsData.error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Error loading data</p>
          <p className="text-sm mt-1">{logsData.error}</p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-1 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === "logs" && (
              <span className="ml-2 px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                {logsData.logs.length}
              </span>
            )}
            {tab.id === "alerts" && (
              <span className="ml-2 px-2 py-0.5 bg-red-900 text-red-300 text-xs rounded-full">
                {logsData.alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "logs" && <LogsTab logsData={logsData} />}
        {activeTab === "alerts" && <AlertsTab logsData={logsData} />}
      </div>
    </div>
  );
}
