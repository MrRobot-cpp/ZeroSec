"use client";
import { useState } from "react";
import PolicyToggle from "./common/PolicyToggle";
import RuleSectionCard from "./common/RuleSectionCard";
import SubscriptionLock from "./common/SubscriptionLock";

export default function CanaryPolicyTab({ onSaveSuccess, onSaveError }) {
  const [policies, setPolicies] = useState({
    enabled: true,
    alertEmail: true,
    alertSIEM: true,
    alertWebhook: false,
    emailRecipients: "security@acme.com",
    siemEndpoint: "https://siem.acme.com/webhook",
    webhookUrl: "",
    autoGenerateCanaries: false,
    canaryFrequency: "monthly",
  });

  const [showCanaryModal, setShowCanaryModal] = useState(false);
  const [generatedCanaries, setGeneratedCanaries] = useState([]);

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

  const handleGenerateCanaries = () => {
    const newCanaries = [
      { id: "canary-001", name: "Q1_Financial_Report.pdf", created: new Date().toISOString() },
      { id: "canary-002", name: "Executive_Briefing_Jan.docx", created: new Date().toISOString() },
      { id: "canary-003", name: "Strategic_Plan_2024.pdf", created: new Date().toISOString() },
    ];
    setGeneratedCanaries(newCanaries);
    setShowCanaryModal(true);
  };

  const handleSave = async () => {
    try {
      console.log("Saving canary policy:", policies);
      onSaveSuccess("Canary Policy updated successfully");
    } catch (err) {
      onSaveError("Failed to save Canary Policy");
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <RuleSectionCard
        title="Canary Forensics Status"
        icon="🐤"
        description="Detect unauthorized access using sophisticated decoy documents"
      >
        <PolicyToggle
          enabled={policies.enabled}
          label="Enable Canary Forensics"
          description="Monitor for unauthorized knowledge access through decoy watermarked documents"
          onChange={() => handleToggle("enabled")}
        />
      </RuleSectionCard>

      {policies.enabled && (
        <>
          {/* How Canaries Work */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-300 mb-3">How Canary Forensics Work</h3>
            <ol className="text-xs text-blue-200 space-y-2">
              <li>
                <strong>1. Generate Decoys:</strong> Create dummy documents with watermarks (Q1 budget, executive memo,
                strategic plan)
              </li>
              <li>
                <strong>2. Place in RAG:</strong> Add canary documents to your document database alongside real documents
              </li>
              <li>
                <strong>3. Monitor Access:</strong> If LLM retrieves a canary document, it indicates a breach or
                unauthorized access attempt
              </li>
              <li>
                <strong>4. Alert Security:</strong> Immediately trigger high-fidelity alert to security team with full
                trace of who queried, when, and what they asked
              </li>
            </ol>
          </div>

          {/* Canary Generation */}
          <RuleSectionCard
            title="Canary Document Generation"
            icon="📋"
            description="Generate decoy documents with forensic watermarks for unauthorized access detection"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Auto-Generate Canaries
                </label>
                <PolicyToggle
                  enabled={policies.autoGenerateCanaries}
                  label="Enable Automatic Generation"
                  description="Automatically create new canary documents on a schedule"
                  onChange={() => handleToggle("autoGenerateCanaries")}
                />
              </div>

              {policies.autoGenerateCanaries && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Generation Frequency
                  </label>
                  <select
                    value={policies.canaryFrequency}
                    onChange={(e) => handleChange("canaryFrequency", e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
              )}

              <button
                onClick={handleGenerateCanaries}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
              >
                <span>🐤</span>
                Generate Canary Documents Now
              </button>
            </div>
          </RuleSectionCard>

          {/* Alert Configuration */}
          <RuleSectionCard
            title="Alert Configuration"
            icon="🚨"
            description="Configure how and where canary breach alerts are sent"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={policies.alertEmail}
                label="Email Alerts"
                description="Send email notification when canary is accessed"
                onChange={() => handleToggle("alertEmail")}
              />

              {policies.alertEmail && (
                <input
                  type="text"
                  value={policies.emailRecipients}
                  onChange={(e) => handleChange("emailRecipients", e.target.value)}
                  placeholder="security@acme.com, soc@acme.com"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              )}

              <PolicyToggle
                enabled={policies.alertSIEM}
                label="SIEM / Security Dashboard Integration"
                description="Send alert to your SIEM system (Splunk, ELK, etc.)"
                onChange={() => handleToggle("alertSIEM")}
              />

              {policies.alertSIEM && (
                <input
                  type="url"
                  value={policies.siemEndpoint}
                  onChange={(e) => handleChange("siemEndpoint", e.target.value)}
                  placeholder="https://siem.acme.com/webhook"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              )}

              <PolicyToggle
                enabled={policies.alertWebhook}
                label="Custom Webhook"
                description="Send alert to custom webhook endpoint"
                onChange={() => handleToggle("alertWebhook")}
              />

              {policies.alertWebhook && (
                <input
                  type="url"
                  value={policies.webhookUrl}
                  onChange={(e) => handleChange("webhookUrl", e.target.value)}
                  placeholder="https://api.yourservice.com/alerts"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              )}
            </div>
          </RuleSectionCard>

          {/* Alert Payload */}
          <RuleSectionCard
            title="Alert Payload"
            icon="📦"
            description="Information included in each alert"
          >
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <ul className="text-sm text-gray-300 space-y-2">
                <li>✓ Canary document ID & name</li>
                <li>✓ User who triggered access</li>
                <li>✓ User's department & role</li>
                <li>✓ Query that led to canary retrieval</li>
                <li>✓ Timestamp of access</li>
                <li>✓ Full conversation context</li>
                <li>✓ Forensic watermark data</li>
                <li>✓ Session ID & IP address</li>
              </ul>
            </div>
          </RuleSectionCard>

          {/* Pro Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubscriptionLock
              title="Advanced Canary Strategies"
              description="Create multi-document canary traps with honeypot data"
              tier="Pro"
            />
            <SubscriptionLock
              title="Behavioral Canaries"
              description="Generate realistic but subtle decoys that blend seamlessly"
              tier="Enterprise"
            />
            <SubscriptionLock
              title="Automated Response"
              description="Automatically revoke access or session upon canary detection"
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

      {/* Generated Canaries Modal */}
      {showCanaryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Generated Canary Documents</h3>
              <button
                onClick={() => setShowCanaryModal(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-300 text-sm mb-4">
              These canary documents have been created and are ready to upload to your document system:
            </p>

            <div className="space-y-2 mb-6">
              {generatedCanaries.map((canary) => (
                <div
                  key={canary.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 border border-gray-600 rounded-lg"
                >
                  <div>
                    <p className="text-white font-medium">{canary.name}</p>
                    <p className="text-xs text-gray-400">{canary.id}</p>
                  </div>
                  <button className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-all">
                    Upload
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-200">
                💡 <strong>Next step:</strong> Upload these documents to your RAG system. They will blend in with your
                real documents, but if retrieved by the LLM, it indicates potential unauthorized access.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCanaryModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-all"
              >
                Close
              </button>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all">
                Upload All to RAG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
