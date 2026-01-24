"use client";
import { useState } from "react";

export default function RuleModal({ type, onSave, onClose }) {
  const [formData, setFormData] = useState({
    pattern: "",
    action: "DENY",
    severity: "medium",
    reason: "",
  });

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!formData.pattern || !formData.reason) {
      alert("Pattern and reason are required");
      return;
    }
    onSave({ ...formData, enabled: true });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Add Rule</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Pattern (regex)
            </label>
            <input
              type="text"
              value={formData.pattern}
              onChange={(e) => handleChange("pattern", e.target.value)}
              placeholder="(?i)(ignore|disregard).*instruction"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Reason
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => handleChange("reason", e.target.value)}
              placeholder="Explain why this rule exists"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Action */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Action
            </label>
            <select
              value={formData.action}
              onChange={(e) => handleChange("action", e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="DENY">Deny (Block)</option>
              <option value="ALERT">Alert Only</option>
              <option value="ALLOW">Allow (Whitelist)</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Severity
            </label>
            <select
              value={formData.severity}
              onChange={(e) => handleChange("severity", e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
          >
            Create Rule
          </button>
        </div>
      </div>
    </div>
  );
}
