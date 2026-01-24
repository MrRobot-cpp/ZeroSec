"use client";
import { useState } from "react";
import PolicyTable from "./common/PolicyTable";
import PolicyToggle from "./common/PolicyToggle";

export default function RetrievalPolicyPanel({ onNotify }) {
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState({
    similarityThreshold: 0.7,
    maxChunkSize: 1000,
    restrictByDepartment: true,
    allowedSensitivity: ["low", "medium"],
  });

  const [restrictions, setRestrictions] = useState([
    {
      id: "res-1",
      type: "Sensitivity",
      criteria: "Sensitivity >= HIGH",
      action: "NEVER RETRIEVE",
      reason: "Only users with top-secret clearance can access high sensitivity docs",
      enabled: true,
    },
    {
      id: "res-2",
      type: "Department",
      criteria: "Department != Finance AND User Department = Finance",
      action: "NEVER RETRIEVE",
      reason: "Finance users cannot access non-finance documents",
      enabled: true,
    },
    {
      id: "res-3",
      type: "Similarity",
      criteria: "Similarity < 0.65",
      action: "NEVER RETRIEVE",
      reason: "Suppress low-relevance results to reduce noise",
      enabled: true,
    },
    {
      id: "res-4",
      type: "Metadata",
      criteria: "Document contains API keys",
      action: "REDACT + RETRIEVE",
      reason: "Strip sensitive fields from chunks before retrieval",
      enabled: true,
    },
  ]);

  const handleToggleRestriction = (id) => {
    setRestrictions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRestriction = (id) => {
    setRestrictions((prev) => prev.filter((r) => r.id !== id));
    onNotify("success", "Restriction deleted");
  };

  const handleSave = () => {
    console.log("Saving retrieval policy:", { settings, restrictions });
    onNotify("success", "Retrieval Policy saved");
  };

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tableColumns = [
    {
      key: "status",
      label: "Status",
      width: "60px",
      render: (row) => (
        <button
          onClick={() => handleToggleRestriction(row.id)}
          className={`w-8 h-5 rounded-full transition-colors ${
            row.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        />
      ),
    },
    {
      key: "type",
      label: "Type",
      width: "100px",
      render: (row) => (
        <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs font-medium">
          {row.type}
        </span>
      ),
    },
    {
      key: "criteria",
      label: "Criteria",
      width: "250px",
      render: (row) => <code className="text-xs text-gray-300 font-mono">{row.criteria}</code>,
    },
    {
      key: "action",
      label: "Action",
      width: "140px",
      render: (row) => (
        <span className="text-xs text-gray-300 font-semibold">{row.action}</span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      width: "auto",
      render: (row) => <span className="text-xs text-gray-400">{row.reason}</span>,
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Retrieval Policy</h2>
            <p className="text-xs text-gray-400 mt-1">
              Control which documents can be retrieved based on user attributes and document metadata
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PolicyToggle enabled={enabled} onChange={() => setEnabled(!enabled)} label="Status" />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
            >
              Save Policy
            </button>
          </div>
        </div>

        {enabled && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3 text-xs text-blue-200">
            Status: Retrieval filtering is active. Documents are filtered by {restrictions.filter((r) => r.enabled).length}{" "}
            active restrictions.
          </div>
        )}
      </div>

      {enabled && (
        <>
          {/* Settings */}
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
              Configuration
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Similarity Threshold</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.similarityThreshold}
                  onChange={(e) => handleSettingChange("similarityThreshold", parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">{settings.similarityThreshold.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Chunk Size (tokens)</label>
                <input
                  type="number"
                  value={settings.maxChunkSize}
                  onChange={(e) => handleSettingChange("maxChunkSize", parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Allowed Sensitivity Levels</label>
                <select
                  multiple
                  value={settings.allowedSensitivity}
                  onChange={(e) =>
                    handleSettingChange(
                      "allowedSensitivity",
                      Array.from(e.target.selectedOptions, (option) => option.value)
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          </div>

          {/* Restrictions Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <PolicyTable
              columns={tableColumns}
              data={restrictions}
              title={`Retrieval Restrictions (${restrictions.filter((r) => r.enabled).length}/${restrictions.length} active)`}
              onDelete={handleDeleteRestriction}
            />
          </div>

          {/* Footer */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 text-xs text-gray-400">
            <p>Hard limit: Documents with sensitivity above user clearance level are never retrieved.</p>
          </div>
        </>
      )}

      {!enabled && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p className="text-sm">Retrieval Policy is disabled. Enable it above to configure restrictions.</p>
        </div>
      )}
    </div>
  );
}
