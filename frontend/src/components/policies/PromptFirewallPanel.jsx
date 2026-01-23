"use client";
import { useState } from "react";
import PolicyTable from "./common/PolicyTable";
import PolicyToggle from "./common/PolicyToggle";
import RuleModal from "./common/RuleModal";

export default function PromptFirewallPanel({ onNotify }) {
  const [enabled, setEnabled] = useState(true);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);

  const [rules, setRules] = useState([
    {
      id: "rule-1",
      pattern: "(?i)(ignore|disregard).*instruction",
      action: "DENY",
      severity: "high",
      reason: "Jailbreak attempt - ignore instructions pattern",
      enabled: true,
    },
    {
      id: "rule-2",
      pattern: "(?i)you are now.*unrestricted",
      action: "DENY",
      severity: "high",
      reason: "Jailbreak attempt - role play as unrestricted",
      enabled: true,
    },
    {
      id: "rule-3",
      pattern: "(?i)(hack|exploit|bypass).*database",
      action: "DENY",
      severity: "critical",
      reason: "SQL injection / database exploitation attempt",
      enabled: true,
    },
    {
      id: "rule-4",
      pattern: "^(SELECT|INSERT|DELETE|DROP|EXEC)\\s",
      action: "DENY",
      severity: "critical",
      reason: "Direct SQL command detected",
      enabled: true,
    },
    {
      id: "rule-5",
      pattern: "(?i)confidential|secret|password",
      action: "ALERT",
      severity: "medium",
      reason: "Potential sensitive data request",
      enabled: true,
    },
  ]);

  const handleTestPrompt = () => {
    if (!testPrompt.trim()) {
      setTestResult(null);
      return;
    }

    const matchedRule = rules.find((r) => r.enabled && new RegExp(r.pattern).test(testPrompt));

    if (matchedRule) {
      setTestResult({
        status: matchedRule.action,
        rule: matchedRule.reason,
        severity: matchedRule.severity,
      });
    } else {
      setTestResult({
        status: "ALLOW",
        rule: "No matching rules - prompt allowed",
        severity: "low",
      });
    }
  };

  const handleToggleRule = (ruleId) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleDeleteRule = (ruleId) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    onNotify("success", "Rule deleted");
  };

  const handleAddRule = (newRule) => {
    setRules((prev) => [...prev, { ...newRule, id: `rule-${Date.now()}` }]);
    setShowAddRule(false);
    onNotify("success", "Rule added");
  };

  const handleSave = () => {
    console.log("Saving prompt firewall rules:", rules);
    onNotify("success", "Prompt Firewall policy saved");
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
      key: "pattern",
      label: "Pattern",
      width: "200px",
      render: (row) => (
        <code className="text-xs font-mono text-gray-300">{row.pattern}</code>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      width: "auto",
      render: (row) => <span className="text-sm text-gray-300">{row.reason}</span>,
    },
    {
      key: "action",
      label: "Action",
      width: "80px",
      render: (row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.action === "DENY"
              ? "bg-red-900/30 text-red-300"
              : row.action === "ALERT"
                ? "bg-yellow-900/30 text-yellow-300"
                : "bg-green-900/30 text-green-300"
          }`}
        >
          {row.action}
        </span>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      width: "80px",
      render: (row) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            row.severity === "critical"
              ? "bg-red-900/30 text-red-300"
              : row.severity === "high"
                ? "bg-orange-900/30 text-orange-300"
                : row.severity === "medium"
                  ? "bg-yellow-900/30 text-yellow-300"
                  : "bg-blue-900/30 text-blue-300"
          }`}
        >
          {row.severity.charAt(0).toUpperCase() + row.severity.slice(1)}
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
            <h2 className="text-base font-semibold text-white">Prompt & Query Firewall</h2>
            <p className="text-xs text-gray-400 mt-1">
              Prevent jailbreak attempts and prompt injection attacks
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PolicyToggle
              enabled={enabled}
              onChange={() => setEnabled(!enabled)}
              label="Status"
            />
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
            Status: Firewall is active. All incoming prompts are checked against {rules.filter((r) => r.enabled).length}{" "}
            active rules.
          </div>
        )}
      </div>

      {enabled && (
        <>
          {/* Test Prompt Section */}
          <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">
              Test Prompt
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                placeholder="Enter a prompt to test against firewall rules..."
                className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={handleTestPrompt}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
              >
                Test
              </button>
            </div>
            {testResult && (
              <div
                className={`mt-3 p-3 rounded text-xs border ${
                  testResult.status === "DENY"
                    ? "bg-red-900/20 border-red-500/30 text-red-200"
                    : testResult.status === "ALERT"
                      ? "bg-yellow-900/20 border-yellow-500/30 text-yellow-200"
                      : "bg-green-900/20 border-green-500/30 text-green-200"
                }`}
              >
                <strong>{testResult.status}:</strong> {testResult.rule}
              </div>
            )}
          </div>

          {/* Rules Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            <PolicyTable
              columns={tableColumns}
              data={rules}
              title={`Active Rules (${rules.filter((r) => r.enabled).length}/${rules.length})`}
              onDelete={handleDeleteRule}
            />
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 flex justify-between items-center">
            <div className="text-xs text-gray-400">
              Total rules: {rules.length} | Active: {rules.filter((r) => r.enabled).length} | Inactive:{" "}
              {rules.filter((r) => !r.enabled).length}
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
          <p className="text-sm">Prompt Firewall is disabled. Enable it above to configure rules.</p>
        </div>
      )}

      {showAddRule && (
        <RuleModal
          type="prompt"
          onSave={handleAddRule}
          onClose={() => setShowAddRule(false)}
        />
      )}
    </div>
  );
}
