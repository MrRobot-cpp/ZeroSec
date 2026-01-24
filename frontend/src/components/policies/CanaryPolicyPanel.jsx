"use client";
import { useState } from "react";
import PolicyToggle from "./common/PolicyToggle";

export default function CanaryPolicyPanel({ onNotify }) {
  const [enabled, setEnabled] = useState(true);
  const [settings, setSettings] = useState({
    alertEmail: true,
    alertSIEM: true,
    alertWebhook: false,
    emailRecipients: "security-team@company.com",
    siemEndpoint: "https://siem.company.com/webhook",
  });

  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [showGeneratedCanaries, setShowGeneratedCanaries] = useState(false);
  const [generatedCanaries, setGeneratedCanaries] = useState([]);

  const handleGenerateCanaries = () => {
    const canaries = [
      {
        id: "canary-001",
        name: "Q1_2024_Financial_Forecast.pdf",
        hash: "a4b9c2d1e5f8g3h6i9j2k5l8m1n4o7p0",
      },
      {
        id: "canary-002",
        name: "Strategic_Board_Minutes_Jan.docx",
        hash: "x7y3z9a2b5c8d1e4f7g2h5i8j1k4l7m0",
      },
      {
        id: "canary-003",
        name: "Acquisition_Target_Analysis.pdf",
        hash: "m4n7o1p4q7r0s3t6u9v2w5x8y1z4a7b0",
      },
    ];

    setGeneratedCanaries(canaries);
    setShowGenerateConfirm(false);
    setShowGeneratedCanaries(true);
    onNotify("success", "Canary documents generated");
  };

  const handleSettingChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    console.log("Saving canary policy:", settings);
    onNotify("success", "Canary Policy saved");
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Canary Policy</h2>
            <p className="text-xs text-gray-400 mt-1">
              Detect unauthorized document access using high-fidelity forensic canaries
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
          <div className="bg-red-900/20 border border-red-500/30 rounded p-3 text-xs text-red-200">
            Critical: Canary policy is active. Any canary document retrieval will trigger immediate high-severity
            alert.
          </div>
        )}
      </div>

      {enabled && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-6">
            {/* How It Works */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">How Canary Forensics Work</h3>
              <ol className="text-xs text-gray-400 space-y-2 ml-4">
                <li>
                  <strong>1. Generate</strong> - Create decoy documents with forensic watermarks indistinguishable from
                  real documents
                </li>
                <li>
                  <strong>2. Deploy</strong> - Add canaries to your RAG document store alongside legitimate documents
                </li>
                <li>
                  <strong>3. Monitor</strong> - System detects if canary is ever retrieved by the LLM during a query
                </li>
                <li>
                  <strong>4. Alert</strong> - Immediate high-confidence alert with full forensic trail (user, query, time,
                  IP, session)
                </li>
              </ol>
            </div>

            {/* Generate Canaries */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-3">Canary Generation</h3>
              <p className="text-xs text-gray-400 mb-3">
                Generate new forensic canary documents to place in your RAG system. Each canary is uniquely watermarked
                and tracked.
              </p>
              <button
                onClick={() => setShowGenerateConfirm(true)}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
              >
                Generate Canary Documents
              </button>
            </div>

            {/* Alert Configuration */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-200 mb-4">Alert Configuration</h3>
              <div className="space-y-4">
                <div className="border border-gray-700 rounded p-3">
                  <div className="flex items-start justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Email Alerts</label>
                    <button
                      onClick={() => handleSettingChange("alertEmail", !settings.alertEmail)}
                      className={`w-8 h-5 rounded-full transition-colors ${
                        settings.alertEmail ? "bg-green-600" : "bg-gray-600"
                      }`}
                    />
                  </div>
                  {settings.alertEmail && (
                    <input
                      type="email"
                      value={settings.emailRecipients}
                      onChange={(e) => handleSettingChange("emailRecipients", e.target.value)}
                      placeholder="security@company.com"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>

                <div className="border border-gray-700 rounded p-3">
                  <div className="flex items-start justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">SIEM Integration</label>
                    <button
                      onClick={() => handleSettingChange("alertSIEM", !settings.alertSIEM)}
                      className={`w-8 h-5 rounded-full transition-colors ${
                        settings.alertSIEM ? "bg-green-600" : "bg-gray-600"
                      }`}
                    />
                  </div>
                  {settings.alertSIEM && (
                    <input
                      type="url"
                      value={settings.siemEndpoint}
                      onChange={(e) => handleSettingChange("siemEndpoint", e.target.value)}
                      placeholder="https://siem.company.com/webhook"
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  )}
                </div>

                <div className="border border-gray-700 rounded p-3">
                  <label className="text-sm font-medium text-gray-300">Alert Payload Includes</label>
                  <ul className="text-xs text-gray-400 mt-2 space-y-1 ml-4">
                    <li>• Canary ID and document name</li>
                    <li>• User identity and department</li>
                    <li>• Full query that triggered canary</li>
                    <li>• Timestamp and session ID</li>
                    <li>• IP address and device info</li>
                    <li>• Forensic watermark metadata</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Active Canaries */}
            {generatedCanaries.length > 0 && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-200 mb-3">Generated Canaries (Pending Upload)</h3>
                <div className="space-y-2">
                  {generatedCanaries.map((canary) => (
                    <div
                      key={canary.id}
                      className="bg-gray-700/50 border border-gray-600 rounded p-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="text-gray-200 font-mono">{canary.name}</p>
                        <p className="text-gray-500 text-xs">{canary.hash}</p>
                      </div>
                      <button className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium">
                        Upload to RAG
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!enabled && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <p className="text-sm">Canary Policy is disabled. Enable it above to configure.</p>
        </div>
      )}

      {/* Generate Confirmation Modal */}
      {showGenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-3">Generate Canary Documents?</h3>
            <p className="text-sm text-gray-300 mb-4">
              This will create 3 new forensic canary documents with unique watermarks. Each canary is tracked
              independently and any retrieval triggers an alert.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              After generation, canaries must be manually uploaded to your RAG system to begin monitoring.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateCanaries}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
