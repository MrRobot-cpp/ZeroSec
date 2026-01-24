"use client";
import { useState } from "react";

const ATTRIBUTES = [
  "department",
  "role",
  "clearance_level",
  "time",
  "day",
  "location",
  "ip_address",
  "device_type",
  "is_corporate_device",
];

const OPERATORS = ["=", "!=", ">", ">=", "<", "<=", "in", "!in", "contains", "matches", "within", "between"];

const OPERATORS_BY_TYPE = {
  string: ["=", "!=", "in", "!in", "contains", "matches"],
  number: ["=", "!=", ">", ">=", "<", "<=", "between"],
  time: ["=", "!=", "within"],
  boolean: ["=", "!="],
  location: ["=", "!=", "in", "!in"],
};

export default function RuleBuilder({ onSave, onClose }) {
  const [ruleName, setRuleName] = useState("");
  const [operator, setOperator] = useState("AND");
  const [conditions, setConditions] = useState([
    { attribute: "department", operator: "=", value: "" },
  ]);

  const handleAddCondition = () => {
    setConditions((prev) => [...prev, { attribute: "department", operator: "=", value: "" }]);
  };

  const handleRemoveCondition = (idx) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConditionChange = (idx, key, val) => {
    setConditions((prev) =>
      prev.map((cond, i) => (i === idx ? { ...cond, [key]: val } : cond))
    );
  };

  const handleSave = () => {
    if (!ruleName.trim()) {
      alert("Please enter a rule name");
      return;
    }
    if (conditions.some((c) => !c.value)) {
      alert("All conditions must have values");
      return;
    }

    onSave({
      name: ruleName,
      operator,
      conditions,
      enabled: true,
    });
  };

  const getOperatorsForAttribute = (attribute) => {
    if (["department", "role", "location", "device_type"].includes(attribute)) {
      return OPERATORS_BY_TYPE.string;
    }
    if (["clearance_level"].includes(attribute)) {
      return OPERATORS_BY_TYPE.number;
    }
    if (["time"].includes(attribute)) {
      return OPERATORS_BY_TYPE.time;
    }
    if (["day"].includes(attribute)) {
      return OPERATORS_BY_TYPE.string;
    }
    if (["is_corporate_device"].includes(attribute)) {
      return OPERATORS_BY_TYPE.boolean;
    }
    return OPERATORS;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Create Access Control Rule</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Rule Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Rule Name
            </label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g., Finance Team After Hours Restriction"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Operator */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Condition Logic
            </label>
            <div className="flex gap-3">
              {["AND", "OR"].map((op) => (
                <button
                  key={op}
                  onClick={() => setOperator(op)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    operator === op
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              <strong>AND:</strong> All conditions must be true
              <br />
              <strong>OR:</strong> Any condition can be true
            </p>
          </div>

          {/* Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Conditions
            </label>

            <div className="space-y-3">
              {conditions.map((condition, idx) => (
                <div
                  key={idx}
                  className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 space-y-3"
                >
                  {idx > 0 && (
                    <div className="text-center">
                      <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium">
                        {operator}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    {/* Attribute */}
                    <select
                      value={condition.attribute}
                      onChange={(e) => handleConditionChange(idx, "attribute", e.target.value)}
                      className="px-3 py-2 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    >
                      {ATTRIBUTES.map((attr) => (
                        <option key={attr} value={attr}>
                          {attr}
                        </option>
                      ))}
                    </select>

                    {/* Operator */}
                    <select
                      value={condition.operator}
                      onChange={(e) => handleConditionChange(idx, "operator", e.target.value)}
                      className="px-3 py-2 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    >
                      {getOperatorsForAttribute(condition.attribute).map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    {/* Value */}
                    <div className="relative">
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => handleConditionChange(idx, "value", e.target.value)}
                        placeholder="e.g., finance"
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                      {idx > 0 && (
                        <button
                          onClick={() => handleRemoveCondition(idx)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-300 text-lg leading-none"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleAddCondition}
              className="mt-3 w-full py-2 text-blue-400 hover:text-blue-300 border border-dashed border-blue-500/50 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            >
              <span>+</span> Add Condition
            </button>
          </div>

          {/* Preview */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              <strong>Preview:</strong> Allow access when {operator === "AND" ? "ALL" : "ANY"} of the conditions below are
              true
            </p>
          </div>

          {/* Save/Cancel */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
            >
              Create Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
