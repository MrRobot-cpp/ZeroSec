"use client";
import { useState } from "react";
import PromptFirewallPanel from "./policies/PromptFirewallPanel";
import RetrievalPolicyPanel from "./policies/RetrievalPolicyPanel";
import OutputPolicyPanel from "./policies/OutputPolicyPanel";
import CanaryPolicyPanel from "./policies/CanaryPolicyPanel";
import ABACPolicyPanel from "./policies/ABACPolicyPanel";

export default function Policies() {
  const [activePolicy, setActivePolicy] = useState("prompt");
  const [notifications, setNotifications] = useState({ success: null, error: null });

  const policies = [
    { id: "prompt", label: "Prompt & Query Firewall", tier: "standard", description: "Jailbreak and injection prevention" },
    { id: "retrieval", label: "Retrieval Policy", tier: "standard", description: "Document access control" },
    { id: "output", label: "Output Policy", tier: "standard", description: "PII masking and leakage prevention" },
    { id: "canary", label: "Canary Policy", tier: "enterprise", description: "Unauthorized access detection" },
    { id: "abac", label: "ABAC Policy", tier: "enterprise", description: "Attribute-based access control" },
  ];

  const showNotification = (type, message) => {
    setNotifications({ success: null, error: null, [type]: message });
    setTimeout(() => setNotifications({ success: null, error: null }), 5000);
  };

  return (
    <div className="h-full flex bg-gray-900 overflow-hidden">
      {/* Left Sidebar Navigation */}
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="border-b border-gray-700 p-4">
          <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">Policies</h2>
        </div>

        {/* Policy List */}
        <div className="flex-1 overflow-y-auto">
          <nav className="space-y-1 p-3">
            {policies.map((policy) => {
              const isActive = activePolicy === policy.id;
              const isLocked = policy.tier === "enterprise";

              return (
                <button
                  key={policy.id}
                  onClick={() => setActivePolicy(policy.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors relative group ${
                    isActive
                      ? "bg-blue-600/20 border border-blue-500/30 text-blue-300"
                      : "text-gray-300 hover:bg-gray-700/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{policy.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{policy.description}</div>
                    </div>
                    {isLocked && (
                      <span className="text-xs bg-orange-600/20 text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/30 whitespace-nowrap ml-2">
                        Enterprise
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Info */}
        <div className="border-t border-gray-700 p-3 text-xs text-gray-400">
          <p>Last updated: Today at 14:23 UTC</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Security Policies</h1>
          <div className="flex items-center gap-3">
            {notifications.success && (
              <div className="text-sm text-green-400 bg-green-900/20 border border-green-500/30 px-3 py-1.5 rounded">
                {notifications.success}
              </div>
            )}
            {notifications.error && (
              <div className="text-sm text-red-400 bg-red-900/20 border border-red-500/30 px-3 py-1.5 rounded">
                {notifications.error}
              </div>
            )}
          </div>
        </div>

        {/* Policy Content */}
        <div className="flex-1 overflow-auto">
          {activePolicy === "prompt" && (
            <PromptFirewallPanel onNotify={showNotification} />
          )}
          {activePolicy === "retrieval" && (
            <RetrievalPolicyPanel onNotify={showNotification} />
          )}
          {activePolicy === "output" && (
            <OutputPolicyPanel onNotify={showNotification} />
          )}
          {activePolicy === "canary" && (
            <CanaryPolicyPanel onNotify={showNotification} />
          )}
          {activePolicy === "abac" && (
            <ABACPolicyPanel onNotify={showNotification} />
          )}
        </div>
      </div>
    </div>
  );
}
