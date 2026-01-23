"use client";
import { useState } from "react";
import PolicyToggle from "./common/PolicyToggle";
import RuleSectionCard from "./common/RuleSectionCard";
import RuleBuilder from "./common/RuleBuilder";
import SubscriptionLock from "./common/SubscriptionLock";

export default function ABACPolicyTab({ onSaveSuccess, onSaveError }) {
  const [policies, setPolicies] = useState({
    enabled: true,
    enforcementMode: "strict", // strict, permissive, custom
  });

  const [rules, setRules] = useState([
    {
      id: "rule-1",
      name: "Finance Department Access",
      operator: "AND",
      conditions: [
        { attribute: "department", operator: "=", value: "finance" },
        { attribute: "clearance_level", operator: ">=", value: "3" },
      ],
      enabled: true,
    },
    {
      id: "rule-2",
      name: "After Hours Restriction",
      operator: "AND",
      conditions: [
        { attribute: "time", operator: "within", value: "09:00-17:00" },
        { attribute: "day", operator: "!=", value: "weekend" },
      ],
      enabled: true,
    },
  ]);

  const [showNewRuleModal, setShowNewRuleModal] = useState(false);

  const handleToggle = (key) => {
    setPolicies((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleChange = (key, value) => {
    setPolicies((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleDeleteRule = (ruleId) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleToggleRule = (ruleId) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, enabled: !r.enabled }
          : r
      )
    );
  };

  const handleAddRule = (newRule) => {
    setRules((prev) => [...prev, { ...newRule, id: `rule-${Date.now()}` }]);
    setShowNewRuleModal(false);
  };

  const handleSave = async () => {
    try {
      console.log("Saving ABAC policy:", { policies, rules });
      onSaveSuccess("ABAC Policy updated successfully");
    } catch (err) {
      onSaveError("Failed to save ABAC Policy");
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <RuleSectionCard
        title="Attribute-Based Access Control (ABAC)"
        icon="🔐"
        description="Define fine-grained access rules based on user attributes and context"
      >
        <PolicyToggle
          enabled={policies.enabled}
          label="Enable ABAC Policy"
          description="Control access to AI system based on user attributes, roles, departments, time, location, and custom attributes"
          onChange={() => handleToggle("enabled")}
        />
      </RuleSectionCard>

      {policies.enabled && (
        <>
          {/* Enforcement Mode */}
          <RuleSectionCard
            title="Enforcement Mode"
            icon="⚙️"
            description="Choose how rules are evaluated"
          >
            <div className="space-y-3">
              {[
                {
                  id: "strict",
                  label: "Strict (Deny by Default)",
                  description: "Block access unless explicitly allowed by a rule",
                },
                {
                  id: "permissive",
                  label: "Permissive (Allow by Default)",
                  description: "Allow access unless explicitly denied by a rule",
                },
                {
                  id: "custom",
                  label: "Custom (Hybrid)",
                  description: "Define both allow and deny rules with priority ordering",
                },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleChange("enforcementMode", mode.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    policies.enforcementMode === mode.id
                      ? "bg-blue-900/30 border-blue-500"
                      : "bg-gray-700 border-gray-600 hover:border-blue-500"
                  }`}
                >
                  <div className="font-medium text-white">{mode.label}</div>
                  <div className="text-sm text-gray-300">{mode.description}</div>
                </button>
              ))}
            </div>
          </RuleSectionCard>

          {/* How ABAC Works */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-purple-300 mb-3">How ABAC Rules Work</h3>
            <ol className="text-xs text-purple-200 space-y-2">
              <li>
                <strong>1. User Submits Query:</strong> User logs in and sends a question to the AI system
              </li>
              <li>
                <strong>2. Attribute Collection:</strong> System collects user attributes (department, role, clearance,
                location, time, IP, etc.)
              </li>
              <li>
                <strong>3. Rule Evaluation:</strong> Rules are evaluated in order against collected attributes
              </li>
              <li>
                <strong>4. Access Decision:</strong> First matching rule determines allow/deny (or default based on
                enforcement mode)
              </li>
              <li>
                <strong>5. Audit Logging:</strong> Decision is logged with full trace of which rule matched and why
              </li>
            </ol>
          </div>

          {/* Rules List */}
          <RuleSectionCard
            title="Access Control Rules"
            icon="📜"
            description="Define and manage attribute-based access rules"
          >
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm mb-4">No rules defined yet</p>
                <button
                  onClick={() => setShowNewRuleModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
                >
                  Create First Rule
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`border rounded-lg p-4 transition-all ${
                      rule.enabled
                        ? "bg-gray-700/50 border-gray-600"
                        : "bg-gray-900/50 border-gray-700 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{rule.name}</h4>
                        <p className="text-xs text-gray-400 mt-1">
                          {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""} ({rule.operator})
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleToggleRule(rule.id)}
                          className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                            rule.enabled
                              ? "bg-green-900/50 text-green-300 border border-green-500"
                              : "bg-gray-800 text-gray-400 border border-gray-600"
                          }`}
                        >
                          {rule.enabled ? "✓ Active" : "✕ Inactive"}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="px-3 py-1 bg-red-900/50 text-red-300 border border-red-500 rounded text-sm font-medium hover:bg-red-900 transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Conditions */}
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="space-y-2">
                        {rule.conditions.map((cond, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            {idx > 0 && (
                              <span className="font-semibold text-blue-400 min-w-fit">{rule.operator}</span>
                            )}
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-gray-300 font-mono">{cond.attribute}</span>
                              <span className="text-gray-500">{cond.operator}</span>
                              <span className="text-yellow-300 font-mono">{cond.value}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setShowNewRuleModal(true)}
                  className="w-full py-2 text-blue-400 hover:text-blue-300 border border-dashed border-blue-500/50 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
                >
                  <span>+</span> Add New Rule
                </button>
              </div>
            )}
          </RuleSectionCard>

          {/* Available Attributes Reference */}
          <RuleSectionCard
            title="Available Attributes"
            icon="📚"
            description="Attributes you can use to build rules"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { attr: "department", type: "string", example: "finance, engineering, sales" },
                { attr: "role", type: "string", example: "admin, analyst, manager" },
                { attr: "clearance_level", type: "number", example: "1-5 (higher = more access)" },
                { attr: "time", type: "time", example: "09:00, 17:30" },
                { attr: "day", type: "day", example: "monday-friday, weekend" },
                { attr: "location", type: "location", example: "office, remote, vpn" },
                { attr: "ip_address", type: "ip", example: "192.168.1.0/24" },
                { attr: "device_type", type: "string", example: "laptop, phone, tablet" },
                { attr: "is_corporate_device", type: "boolean", example: "true, false" },
              ].map((attr) => (
                <div key={attr.attr} className="bg-gray-700/30 border border-gray-600 rounded p-3">
                  <code className="text-yellow-300 text-xs font-mono">{attr.attr}</code>
                  <p className="text-xs text-gray-400 mt-1">{attr.type}</p>
                  <p className="text-xs text-gray-500 mt-1">e.g., {attr.example}</p>
                </div>
              ))}
            </div>
          </RuleSectionCard>

          {/* Operators Reference */}
          <RuleSectionCard
            title="Comparison Operators"
            icon="🔍"
            description="Operators available for condition evaluation"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { op: "=", desc: "Equals" },
                { op: "!=", desc: "Not equals" },
                { op: ">", desc: "Greater than (numbers)" },
                { op: ">=", desc: "Greater than or equal" },
                { op: "<", desc: "Less than (numbers)" },
                { op: "<=", desc: "Less than or equal" },
                { op: "in", desc: "Value is in list" },
                { op: "!in", desc: "Value is not in list" },
                { op: "contains", desc: "String contains" },
                { op: "matches", desc: "Regex match" },
                { op: "within", desc: "Time range (HH:MM-HH:MM)" },
                { op: "between", desc: "Number range" },
              ].map((op) => (
                <div key={op.op} className="bg-gray-700/30 border border-gray-600 rounded p-3">
                  <code className="text-blue-300 text-sm font-mono">{op.op}</code>
                  <p className="text-xs text-gray-400 mt-1">{op.desc}</p>
                </div>
              ))}
            </div>
          </RuleSectionCard>

          {/* Pro Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubscriptionLock
              title="Conditional Rule Logic"
              description="Support for NOT, XOR, and complex nested boolean logic"
              tier="Pro"
            />
            <SubscriptionLock
              title="Rule Conflict Resolution"
              description="Automatic detection and resolution of conflicting rules"
              tier="Pro"
            />
            <SubscriptionLock
              title="Dynamic Attributes"
              description="Connect external identity providers (LDAP, Active Directory, Okta)"
              tier="Enterprise"
            />
            <SubscriptionLock
              title="Policy Simulation"
              description="Test rules against historical user sessions before deployment"
              tier="Enterprise"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all">
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
            >
              Save Policy
            </button>
          </div>
        </>
      )}

      {/* New Rule Modal */}
      {showNewRuleModal && (
        <RuleBuilder
          onSave={handleAddRule}
          onClose={() => setShowNewRuleModal(false)}
        />
      )}
    </div>
  );
}
