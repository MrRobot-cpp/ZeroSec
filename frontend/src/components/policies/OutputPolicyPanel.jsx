"use client";
import { useState } from "react";
import PolicyTable from "./common/PolicyTable";
import PolicyToggle from "./common/PolicyToggle";

export default function OutputPolicyPanel({ onNotify }) {
  const [enabled, setEnabled] = useState(true);

  const [maskingRules, setMaskingRules] = useState([
    {
      id: "mask-1",
      type: "Email Address",
      pattern: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}",
      action: "REDACT",
      replacement: "[EMAIL_REDACTED]",
      enabled: true,
    },
    {
      id: "mask-2",
      type: "Phone Number",
      pattern: "\\+?\\d{1,3}[-.\\s]?\\(?\\d{1,4}\\)?[-.\\s]?\\d{1,4}[-.\\s]?\\d{1,9}",
      action: "REDACT",
      replacement: "[PHONE_REDACTED]",
      enabled: true,
    },
    {
      id: "mask-3",
      type: "Social Security Number",
      pattern: "\\d{3}-\\d{2}-\\d{4}",
      action: "REDACT",
      replacement: "[SSN_REDACTED]",
      enabled: true,
    },
    {
      id: "mask-4",
      type: "API Key",
      pattern: "(?i)(sk-[a-zA-Z0-9]{20,}|api[_-]?key[=:]\\s*[a-zA-Z0-9]{32,})",
      action: "REDACT",
      replacement: "[API_KEY_REDACTED]",
      enabled: true,
    },
    {
      id: "mask-5",
      type: "Credit Card",
      pattern: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
      action: "REDACT",
      replacement: "[CC_REDACTED]",
      enabled: false,
    },
  ]);

  const [leakageRules, setLeakageRules] = useState([
    {
      id: "leak-1",
      type: "Training Data Leak",
      pattern: "This is a prompt from the training data|training example",
      action: "REFUSE",
      reason: "System prompt or training data exposure detected",
      enabled: true,
    },
    {
      id: "leak-2",
      type: "Database Schema",
      pattern: "(?i)table|column|schema.*database|CREATE TABLE",
      action: "ALERT",
      reason: "Potential database structure exposure",
      enabled: true,
    },
    {
      id: "leak-3",
      type: "Internal URLs",
      pattern: "(?i)(internal\\.|vpn\\.|admin\\.)[a-z0-9.-]+|\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}",
      action: "REDACT",
      reason: "Internal network information detected",
      enabled: true,
    },
  ]);

  const handleToggleRule = (ruleId, type) => {
    if (type === "masking") {
      setMaskingRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
      );
    } else {
      setLeakageRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
      );
    }
  };

  const handleDeleteRule = (ruleId, type) => {
    if (type === "masking") {
      setMaskingRules((prev) => prev.filter((r) => r.id !== ruleId));
    } else {
      setLeakageRules((prev) => prev.filter((r) => r.id !== ruleId));
    }
    onNotify("success", "Rule deleted");
  };

  const handleSave = () => {
    console.log("Saving output policy:", { maskingRules, leakageRules });
    onNotify("success", "Output Policy saved");
  };

  const maskingColumns = [
    {
      key: "status",
      label: "Status",
      width: "60px",
      render: (row) => (
        <button
          onClick={() => handleToggleRule(row.id, "masking")}
          className={`w-8 h-5 rounded-full transition-colors ${
            row.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        />
      ),
    },
    {
      key: "type",
      label: "PII Type",
      width: "120px",
      render: (row) => <span className="text-sm text-gray-300">{row.type}</span>,
    },
    {
      key: "pattern",
      label: "Pattern",
      width: "200px",
      render: (row) => <code className="text-xs text-gray-500 font-mono">{row.pattern.substring(0, 30)}...</code>,
    },
    {
      key: "replacement",
      label: "Replacement",
      width: "150px",
      render: (row) => (
        <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded text-xs font-mono">
          {row.replacement}
        </span>
      ),
    },
  ];

  const leakageColumns = [
    {
      key: "status",
      label: "Status",
      width: "60px",
      render: (row) => (
        <button
          onClick={() => handleToggleRule(row.id, "leakage")}
          className={`w-8 h-5 rounded-full transition-colors ${
            row.enabled ? "bg-green-600" : "bg-gray-600"
          }`}
        />
      ),
    },
    {
      key: "type",
      label: "Leak Type",
      width: "150px",
      render: (row) => <span className="text-sm text-gray-300">{row.type}</span>,
    },
    {
      key: "reason",
      label: "Reason",
      width: "auto",
      render: (row) => <span className="text-sm text-gray-400">{row.reason}</span>,
    },
    {
      key: "action",
      label: "Action",
      width: "100px",
      render: (row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.action === "REFUSE"
              ? "bg-red-900/30 text-red-300"
              : row.action === "ALERT"
                ? "bg-yellow-900/30 text-yellow-300"
                : "bg-blue-900/30 text-blue-300"
          }`}
        >
          {row.action}
        </span>
      ),
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Output Policy</h2>
            <p className="text-xs text-gray-400 mt-1">
              Control PII masking, toxicity filtering, and information leakage prevention
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
            Status: Output filtering is active. All LLM responses are scanned with{" "}
            {maskingRules.filter((r) => r.enabled).length + leakageRules.filter((r) => r.enabled).length} active rules.
          </div>
        )}
      </div>

      {enabled && (
        <>
          {/* PII Masking Rules */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <PolicyTable
              columns={maskingColumns}
              data={maskingRules}
              title={`PII Masking Rules (${maskingRules.filter((r) => r.enabled).length}/${maskingRules.length} active)`}
              onDelete={(id) => handleDeleteRule(id, "masking")}
            />

            <div className="mt-6" />

            {/* Leakage Prevention Rules */}
            <PolicyTable
              columns={leakageColumns}
              data={leakageRules}
              title={`Information Leakage Prevention (${leakageRules.filter((r) => r.enabled).length}/${leakageRules.length} active)`}
              onDelete={(id) => handleDeleteRule(id, "leakage")}
            />
          </div>

          {/* Footer */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 space-y-2">
            <p className="text-xs text-gray-400">
              Outcome Behaviors: <strong>REDACT</strong> = Replace with placeholder | <strong>REFUSE</strong> = Block
              response | <strong>ALERT</strong> = Flag for review
            </p>
          </div>
        </>
      )}

      {!enabled && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p className="text-sm">Output Policy is disabled. Enable it above to configure rules.</p>
        </div>
      )}
    </div>
  );
}
