"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("integrations");

  const tabs = [
    { id: "integrations", label: "Integrations", icon: "🔌" },
    { id: "system", label: "System Settings", icon: "⚙️" },
    { id: "credentials", label: "Credentials", icon: "🔑" },
    { id: "deployment", label: "Deployment", icon: "🚀" },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm">
          <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Settings & Integrations</h1>
              <p className="text-gray-400 text-sm mt-1">
                Configure your ZeroSec instance and manage integrations
              </p>
            </div>
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors">
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-500"
                      : "border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300"
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "system" && <SystemSettingsTab />}
          {activeTab === "credentials" && <CredentialsTab />}
          {activeTab === "deployment" && <DeploymentTab />}
        </div>
      </div>
    </div>
  );
}

// Integrations Tab
function IntegrationsTab() {
  const [expandedSection, setExpandedSection] = useState(null);

  const integrations = {
    vectorDB: {
      title: "Vector Databases",
      description: "Connect to vector databases for embeddings storage",
      providers: [
        {
          name: "Pinecone",
          connected: false,
          fields: [
            { label: "API Key", type: "password", placeholder: "pcone_..." },
            { label: "Environment", type: "text", placeholder: "us-east-1" },
            { label: "Index Name", type: "text", placeholder: "zerosec-index" },
          ],
        },
        {
          name: "Qdrant",
          logo: "🔷",
          connected: false,
          fields: [
            { label: "API URL", type: "text", placeholder: "https://..." },
            { label: "API Key", type: "password", placeholder: "Optional" },
            { label: "Collection Name", type: "text", placeholder: "documents" },
          ],
        },
        {
          name: "Weaviate",
          logo: "🌊",
          connected: true,
          fields: [
            { label: "API URL", type: "text", placeholder: "https://..." },
            { label: "API Key", type: "password", placeholder: "Optional" },
            { label: "Class Name", type: "text", placeholder: "Document" },
          ],
        },
      ],
    },
    llm: {
      title: "LLM Providers",
      description: "Configure AI model providers",
      providers: [
        {
          name: "OpenAI",
          logo: "🤖",
          connected: true,
          fields: [
            { label: "API Key", type: "password", placeholder: "sk-..." },
            { label: "Organization ID", type: "text", placeholder: "org-..." },
            { label: "Default Model", type: "select", options: ["gpt-4", "gpt-3.5-turbo"] },
          ],
        },
        {
          name: "Anthropic",
          logo: "🧠",
          connected: false,
          fields: [
            { label: "API Key", type: "password", placeholder: "sk-ant-..." },
            { label: "Default Model", type: "select", options: ["claude-3-opus", "claude-3-sonnet"] },
          ],
        },
        {
          name: "Cohere",
          logo: "💫",
          connected: false,
          fields: [
            { label: "API Key", type: "password", placeholder: "..." },
            { label: "Model Type", type: "select", options: ["command", "embed"] },
          ],
        },
      ],
    },
    rag: {
      title: "RAG Frameworks",
      description: "Integrate with RAG orchestration frameworks",
      providers: [
        {
          name: "LangChain",
          logo: "🦜",
          connected: true,
          fields: [
            { label: "Callback URL", type: "text", placeholder: "https://..." },
            { label: "Webhook Secret", type: "password", placeholder: "..." },
          ],
        },
        {
          name: "LlamaIndex",
          logo: "🦙",
          connected: false,
          fields: [
            { label: "API Endpoint", type: "text", placeholder: "https://..." },
            { label: "Access Token", type: "password", placeholder: "..." },
          ],
        },
      ],
    },
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-6">
      {Object.entries(integrations).map(([key, category]) => (
        <div key={key} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-2">{category.title}</h3>
            <p className="text-sm text-gray-400 mb-4">{category.description}</p>

            <div className="space-y-4">
              {category.providers.map((provider, idx) => (
                <div
                  key={idx}
                  className="border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors"
                >
                  <button
                    onClick={() => toggleSection(`${key}-${idx}`)}
                    className="w-full p-4 flex items-center justify-between bg-gray-900 hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{provider.logo}</span>
                      <div className="text-left">
                        <div className="font-medium">{provider.name}</div>
                        <div className="text-xs text-gray-400">
                          {provider.connected ? (
                            <span className="text-green-400 flex items-center">
                              <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-1"></span>
                              Connected
                            </span>
                          ) : (
                            <span className="text-gray-500">Not connected</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedSection === `${key}-${idx}` ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {expandedSection === `${key}-${idx}` && (
                    <div className="p-4 bg-gray-800/50 border-t border-gray-700">
                      <div className="space-y-4">
                        {provider.fields.map((field, fieldIdx) => (
                          <div key={fieldIdx}>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              {field.label}
                            </label>
                            {field.type === "select" ? (
                              <select className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {field.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={field.type}
                                placeholder={field.placeholder}
                                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            )}
                          </div>
                        ))}
                        <div className="flex space-x-3 pt-2">
                          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors">
                            {provider.connected ? "Update" : "Connect"}
                          </button>
                          {provider.connected && (
                            <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-sm font-medium transition-colors">
                              Disconnect
                            </button>
                          )}
                          <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium transition-colors">
                            Test Connection
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// System Settings Tab
function SystemSettingsTab() {
  return (
    <div className="space-y-6">
      {/* Rate Limiting */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">⚡</span>
          Rate Limiting
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Requests per Minute
              </label>
              <input
                type="number"
                defaultValue={100}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Burst Limit
              </label>
              <input
                type="number"
                defaultValue={200}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <span className="text-sm text-gray-300">Enable IP-based rate limiting</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Log Retention */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">📝</span>
          Log Retention
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Retention Period (days)
            </label>
            <select className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30} selected>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <span className="text-sm text-gray-300">Auto-archive old logs</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Masking Behavior */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🎭</span>
          Data Masking
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <div>
              <div className="text-sm font-medium text-gray-300">Email Addresses</div>
              <div className="text-xs text-gray-500">user@example.com → u***@e***.com</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <div>
              <div className="text-sm font-medium text-gray-300">Credit Card Numbers</div>
              <div className="text-xs text-gray-500">1234-5678-9012-3456 → ****-****-****-3456</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <div>
              <div className="text-sm font-medium text-gray-300">Phone Numbers</div>
              <div className="text-xs text-gray-500">+1-234-567-8900 → +1-***-***-8900</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <div>
              <div className="text-sm font-medium text-gray-300">SSN</div>
              <div className="text-xs text-gray-500">123-45-6789 → ***-**-6789</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Security Thresholds */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🛡️</span>
          Security Thresholds
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Threat Detection Sensitivity
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={75}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-400 w-16 text-right">75%</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Permissive</span>
              <span>Strict</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PII Detection Threshold
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="100"
                defaultValue={85}
                className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-400 w-16 text-right">85%</span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Auto-block Threshold
            </label>
            <select className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="low">Low (90% confidence)</option>
              <option value="medium" selected>Medium (95% confidence)</option>
              <option value="high">High (99% confidence)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// Credentials Tab
function CredentialsTab() {
  const credentials = [
    {
      name: "Production API Key",
      type: "API Key",
      created: "2024-01-15",
      lastUsed: "2 hours ago",
      status: "active",
    },
    {
      name: "Development API Key",
      type: "API Key",
      created: "2024-01-10",
      lastUsed: "1 day ago",
      status: "active",
    },
    {
      name: "Data Encryption Key",
      type: "Encryption Key",
      created: "2024-01-01",
      lastUsed: "5 minutes ago",
      status: "active",
    },
    {
      name: "Backup Encryption Key",
      type: "Encryption Key",
      created: "2023-12-15",
      lastUsed: "Never",
      status: "inactive",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Add New Credential */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">➕</span>
          Generate New Credential
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Credential Type
            </label>
            <select className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>API Key</option>
              <option>Encryption Key</option>
              <option>Access Token</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g., Production API Key"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-medium transition-colors">
          Generate New Credential
        </button>
      </div>

      {/* Existing Credentials */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center">
            <span className="mr-2">🔑</span>
            Existing Credentials
          </h3>
        </div>
        <div className="divide-y divide-gray-700">
          {credentials.map((cred, idx) => (
            <div key={idx} className="p-4 hover:bg-gray-700/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="font-medium">{cred.name}</div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        cred.status === "active"
                          ? "bg-green-900/30 text-green-400 border border-green-700"
                          : "bg-gray-700 text-gray-400 border border-gray-600"
                      }`}
                    >
                      {cred.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-400">
                    <span>Type: {cred.type}</span>
                    <span>•</span>
                    <span>Created: {cred.created}</span>
                    <span>•</span>
                    <span>Last used: {cred.lastUsed}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button className="p-2 hover:bg-gray-600 rounded-md transition-colors" title="Copy">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-gray-600 rounded-md transition-colors" title="Rotate">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  </button>
                  <button className="p-2 hover:bg-red-600 rounded-md transition-colors text-red-400" title="Revoke">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rotation Policy */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🔄</span>
          Automatic Rotation Policy
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
            <span className="text-sm text-gray-300">Enable automatic key rotation</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Rotation Interval
            </label>
            <select className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90} selected>90 days</option>
              <option value={180}>180 days</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// Deployment Tab
function DeploymentTab() {
  const deploymentStatus = {
    proxy: {
      status: "healthy",
      version: "v2.1.3",
      uptime: "15 days, 3 hours",
      requests: "2.4M",
    },
    sdk: {
      status: "healthy",
      connections: 12,
      activeClients: ["web-app-prod", "mobile-app", "analytics-service"],
    },
    workers: [
      { name: "threat-detector-1", status: "healthy", cpu: 45, memory: 62, uptime: "15d 3h" },
      { name: "threat-detector-2", status: "healthy", cpu: 38, memory: 58, uptime: "15d 3h" },
      { name: "pii-scanner-1", status: "healthy", cpu: 52, memory: 71, uptime: "15d 3h" },
      { name: "log-processor-1", status: "warning", cpu: 78, memory: 85, uptime: "2d 14h" },
      { name: "vector-indexer-1", status: "healthy", cpu: 33, memory: 44, uptime: "15d 3h" },
    ],
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "healthy":
        return "bg-green-900/30 text-green-400 border-green-700";
      case "warning":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-700";
      case "error":
        return "bg-red-900/30 text-red-400 border-red-700";
      default:
        return "bg-gray-700 text-gray-400 border-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Proxy Status */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🌐</span>
          Proxy Status
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Status</div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(deploymentStatus.proxy.status)}`}>
                {deploymentStatus.proxy.status}
              </span>
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Version</div>
            <div className="text-lg font-semibold">{deploymentStatus.proxy.version}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Uptime</div>
            <div className="text-lg font-semibold">{deploymentStatus.proxy.uptime}</div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Requests Processed</div>
            <div className="text-lg font-semibold">{deploymentStatus.proxy.requests}</div>
          </div>
        </div>
      </div>

      {/* SDK Connection Status */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">🔌</span>
          SDK Connection Status
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Status</div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(deploymentStatus.sdk.status)}`}>
                {deploymentStatus.sdk.status}
              </span>
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Active Connections</div>
            <div className="text-lg font-semibold">{deploymentStatus.sdk.connections}</div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-300 mb-2">Connected Clients</div>
          <div className="space-y-2">
            {deploymentStatus.sdk.activeClients.map((client, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-900 rounded-md">
                <div className="flex items-center space-x-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full"></span>
                  <span className="text-sm">{client}</span>
                </div>
                <span className="text-xs text-gray-500">Connected</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workers Health */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold flex items-center">
            <span className="mr-2">⚙️</span>
            Workers Health
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-900 border-b border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Worker Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  CPU Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Memory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Uptime
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {deploymentStatus.workers.map((worker, idx) => (
                <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium">{worker.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(worker.status)}`}>
                      {worker.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 w-20">
                        <div
                          className={`h-2 rounded-full ${
                            worker.cpu > 70 ? "bg-red-500" : worker.cpu > 50 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${worker.cpu}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-400">{worker.cpu}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-700 rounded-full h-2 w-20">
                        <div
                          className={`h-2 rounded-full ${
                            worker.memory > 80 ? "bg-red-500" : worker.memory > 60 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${worker.memory}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-400">{worker.memory}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{worker.uptime}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                      Restart
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Resources */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className="mr-2">💻</span>
          System Resources
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Overall CPU Usage</div>
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-gray-700 rounded-full h-3">
                <div className="bg-blue-500 h-3 rounded-full" style={{ width: "49%" }}></div>
              </div>
              <span className="text-lg font-semibold">49%</span>
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Overall Memory Usage</div>
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-gray-700 rounded-full h-3">
                <div className="bg-yellow-500 h-3 rounded-full" style={{ width: "64%" }}></div>
              </div>
              <span className="text-lg font-semibold">64%</span>
            </div>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg">
            <div className="text-sm text-gray-400 mb-2">Disk Usage</div>
            <div className="flex items-center space-x-3">
              <div className="flex-1 bg-gray-700 rounded-full h-3">
                <div className="bg-green-500 h-3 rounded-full" style={{ width: "32%" }}></div>
              </div>
              <span className="text-lg font-semibold">32%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
