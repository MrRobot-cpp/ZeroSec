"use client";
import { useState } from "react";
import PolicyTable from "./common/PolicyTable";
import PolicyToggle from "./common/PolicyToggle";

export default function ABACPolicyPanel({ onNotify }) {
  const [enabled, setEnabled] = useState(true);
  const [enforcementMode, setEnforcementMode] = useState("strict");

  const [rules, setRules] = useState([
    {
      id: "abac-1",
      name: "Finance Department - Working Hours",
      conditions: [
        { attribute: "department", operator: "=", value: "finance" },
        { attribute: "time", operator: "within", value: "09:00-17:00" },
      ],
      operator: "AND",
      outcome: "ALLOW",
      summary: "Allow Finance dept access during 09:00-17:00 UTC",
      enabled: true,
    },
    {
      id: "abac-2",
      name: "High Sensitivity - Top Secret Only",
      conditions: [
        { attribute: "document_sensitivity", operator: "=", value: "high" },
        { attribute: "user_clearance", operator: "<", value: "5" },
      ],
      operator: "AND",
      outcome: "DENY",
      summary: "Deny high sensitivity docs to users without clearance level 5",
      enabled: true,
    },
    {
      id: "abac-3",
      name: "Remote Access Restriction",
      conditions: [{ attribute: "location", operator: "!=", value: "office" }],
      operator: "AND",
      outcome: "DENY",
      summary: "Deny all access from non-office locations",
      enabled: true,
    },
    {
      id: "abac-4",
      name: "External Device Block",
      conditions: [{ attribute: "is_corporate_device", operator: "=", value: "false" }],
      operator: "AND",
      outcome: "DENY",
      summary: "Deny access from non-corporate devices",
      enabled: false,
    },
  ]);

  const [showAddRule, setShowAddRule] = useState(false);

  const handleToggleRule = (id) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRule = (id) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    onNotify("success", "Rule deleted");
  };

  const handleSave = () => {
    console.log("Saving ABAC policy:", { rules, enforcementMode });
    onNotify("success", "ABAC Policy saved");
  };

  const tableColumns = [
    {
      key: "status",
      label: "Status",
      width: "60px",
      render: (row) => (
        <button
          onClick={() => handleToggleRule(row.id)}
          className={`w-8 h-5 rounded-full transition-colors ${
            row.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        />
      ),
    },
    {
      key: "name",
      label: "Rule Name",
      width: "180px",
      render: (row) => <span className="text-sm font-medium text-gray-300">{row.name}</span>,
    },
    {
      key: "outcome",
      label: "Outcome",
      width: "80px",
      render: (row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.outcome === "ALLOW"
              ? "bg-green-900/30 text-green-300"
              : "bg-red-900/30 text-red-300"
          }`}
        >
          {row.outcome}
        </span>
      ),
    },
    {
      key: "summary",
      label: "Summary",
      width: "auto",
      render: (row) => <span className="text-xs text-gray-400">{row.summary}</span>,
    },
    {
      key: "conditions",
      label: "Conditions",
      width: "100px",
      render: (row) => (
        <span className="text-xs text-gray-500">{row.conditions.length} condition(s)</span>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">ABAC Policy</h2>
            <p className="text-xs text-gray-400 mt-1">
              Define attribute-based access control rules using user and document attributes
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
            Enforcement Mode: <strong>{enforcementMode.toUpperCase()}</strong> - Access is{" "}
            {enforcementMode === "strict"
              ? "denied by default unless explicitly allowed"
              : "allowed by default unless explicitly denied"}
            .
          </div>
        )}
      </div>

      {enabled && (
        <>
          {/* Enforcement Mode Selection */}
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
              Enforcement Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              {["strict", "permissive"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setEnforcementMode(mode)}
                  className={`text-left p-3 rounded border-2 transition-colors ${
                    enforcementMode === mode
                      ? "bg-blue-900/30 border-blue-500 text-blue-300"
                      : "bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-500"
                  }`}
                >
                  <div className="font-medium text-sm">
                    {mode === "strict" ? "Strict (Deny by Default)" : "Permissive (Allow by Default)"}
                  </div>
                  <div className="text-xs mt-1">
                    {mode === "strict"
                      ? "Only allow what is explicitly permitted"
                      : "Allow everything except explicitly denied"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Rules Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <PolicyTable
              columns={tableColumns}
              data={rules}
              title={`Access Rules (${rules.filter((r) => r.enabled).length}/${rules.length} active)`}
              onDelete={handleDeleteRule}
            />
          </div>

          {/* Available Attributes Reference */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-3">
              Available Attributes for Rules
            </h3>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">department</code>
                <p className="text-gray-500 mt-1">finance, engineering, sales, legal</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">user_clearance</code>
                <p className="text-gray-500 mt-1">1-5 (higher = more access)</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">time</code>
                <p className="text-gray-500 mt-1">09:00, 17:30 (24h format)</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">location</code>
                <p className="text-gray-500 mt-1">office, remote, vpn</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">document_sensitivity</code>
                <p className="text-gray-500 mt-1">low, medium, high</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">is_corporate_device</code>
                <p className="text-gray-500 mt-1">true, false</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">device_type</code>
                <p className="text-gray-500 mt-1">laptop, phone, tablet</p>
              </div>
              <div className="bg-gray-700/50 border border-gray-600 rounded p-2">
                <code className="text-blue-300">day_of_week</code>
                <p className="text-gray-500 mt-1">mon-fri, weekday, weekend</p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 flex justify-between items-center">
            <div className="text-xs text-gray-400">
              Rules evaluated in order. First match determines access decision.
            </div>
            <button
              onClick={() => setShowAddRule(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
            >
              Add Rule
            </button>
          </div>
        </>
      )}

      {!enabled && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p className="text-sm">ABAC Policy is disabled. Enable it above to configure rules.</p>
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-3">Add ABAC Rule</h3>
            <p className="text-sm text-gray-400 mb-4">
              Visual rule builder coming soon. For now, contact support to add complex ABAC rules.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAddRule(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
