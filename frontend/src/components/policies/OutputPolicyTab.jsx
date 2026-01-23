"use client";
import { useState } from "react";
import PolicyToggle from "./common/PolicyToggle";
import RuleSectionCard from "./common/RuleSectionCard";
import RangeSlider from "./common/RangeSlider";
import OutputPreview from "./common/OutputPreview";
import SubscriptionLock from "./common/SubscriptionLock";

export default function OutputPolicyTab({ onSaveSuccess, onSaveError }) {
  const [policies, setPolicies] = useState({
    enabled: true,
    maskEmail: true,
    maskPhone: true,
    maskSSN: true,
    maskAPIKeys: true,
    maskCreditCard: false,
    toxicityThreshold: 0.7,
    preventLeakage: true,
    preventCrossDomain: false,
  });

  const [previewMode, setPreviewMode] = useState("email");

  const PREVIEW_OUTPUTS = {
    email: {
      original:
        "Contact our support team at john.doe@acme.com or sarah.smith@acme.com for assistance.",
      masked: "Contact our support team at [EMAIL_REDACTED] or [EMAIL_REDACTED] for assistance.",
    },
    phone: {
      original: "Call us at +1-555-123-4567 or +44-20-7946-0958 for support.",
      masked: "Call us at [PHONE_REDACTED] or [PHONE_REDACTED] for support.",
    },
    ssn: {
      original: "Customer ID: 123-45-6789. SSN on file: 987-65-4321.",
      masked: "Customer ID: 123-45-6789. SSN on file: [SSN_REDACTED].",
    },
    apikey: {
      original:
        "Your API key is sk-proj-abc123def456ghi789jkl. Keep it secret: sk_live_XYZ123...",
      masked: "Your API key is [API_KEY_REDACTED]. Keep it secret: [API_KEY_REDACTED]...",
    },
  };

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

  const handleSave = async () => {
    try {
      console.log("Saving output policy:", policies);
      onSaveSuccess("Output Policy updated successfully");
    } catch (err) {
      onSaveError("Failed to save Output Policy");
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <RuleSectionCard
        title="Output Protection Status"
        icon="📤"
        description="Control what sensitive information is allowed in LLM responses"
      >
        <PolicyToggle
          enabled={policies.enabled}
          label="Enable Output Policy"
          description="When enabled, LLM outputs are scanned and sanitized for PII and sensitive data"
          onChange={() => handleToggle("enabled")}
        />
      </RuleSectionCard>

      {policies.enabled && (
        <>
          {/* PII Masking */}
          <RuleSectionCard
            title="Personally Identifiable Information (PII) Masking"
            icon="🔒"
            description="Automatically redact or mask sensitive personal data in responses"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={policies.maskEmail}
                label="Mask Email Addresses"
                description="Replace detected email addresses with [EMAIL_REDACTED]"
                onChange={() => handleToggle("maskEmail")}
              />

              <PolicyToggle
                enabled={policies.maskPhone}
                label="Mask Phone Numbers"
                description="Replace detected phone numbers with [PHONE_REDACTED]"
                onChange={() => handleToggle("maskPhone")}
              />

              <PolicyToggle
                enabled={policies.maskSSN}
                label="Mask Social Security Numbers"
                description="Replace detected SSNs with [SSN_REDACTED]"
                onChange={() => handleToggle("maskSSN")}
              />

              <PolicyToggle
                enabled={policies.maskAPIKeys}
                label="Mask API Keys & Tokens"
                description="Replace detected API keys, tokens, and secrets with [API_KEY_REDACTED]"
                onChange={() => handleToggle("maskAPIKeys")}
              />

              <PolicyToggle
                enabled={policies.maskCreditCard}
                label="Mask Credit Card Numbers"
                description="Replace detected credit card numbers with [CC_REDACTED]"
                onChange={() => handleToggle("maskCreditCard")}
              />
            </div>
          </RuleSectionCard>

          {/* Output Preview */}
          <RuleSectionCard
            title="Preview PII Masking"
            icon="👁️"
            description="See how masking rules affect outputs"
          >
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {Object.keys(PREVIEW_OUTPUTS).map((key) => (
                  <button
                    key={key}
                    onClick={() => setPreviewMode(key)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                      previewMode === key
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    }`}
                  >
                    {key === "email"
                      ? "📧 Email"
                      : key === "phone"
                        ? "📞 Phone"
                        : key === "ssn"
                          ? "🆔 SSN"
                          : "🔑 API Keys"}
                  </button>
                ))}
              </div>

              <OutputPreview output={PREVIEW_OUTPUTS[previewMode]} />
            </div>
          </RuleSectionCard>

          {/* Toxicity Filter */}
          <RuleSectionCard
            title="Toxicity & Harmful Content Filter"
            icon="⚠️"
            description="Block responses that contain toxic, abusive, or harmful language"
          >
            <div className="space-y-4">
              <RangeSlider
                min={0}
                max={1}
                step={0.05}
                value={policies.toxicityThreshold}
                onChange={(value) => handleChange("toxicityThreshold", value)}
                label="Toxicity Score Threshold"
                format={(val) => `${(val * 100).toFixed(0)}%`}
              />
              <p className="text-xs text-gray-400">
                <strong>Example:</strong> Setting to 0.7 means block any response with 70%+ likelihood of containing
                toxic content. Lower values = stricter (fewer toxic outputs).
              </p>
            </div>
          </RuleSectionCard>

          {/* Leakage Prevention */}
          <RuleSectionCard
            title="Leakage Prevention"
            icon="🚨"
            description="Prevent accidental disclosure of sensitive information patterns"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={policies.preventLeakage}
                label="Block Information Leakage"
                description="Detect and block patterns that indicate accidental disclosure of: training data, system prompts, database schemas, internal URLs, configuration details"
                onChange={() => handleToggle("preventLeakage")}
              />

              <PolicyToggle
                enabled={policies.preventCrossDomain}
                label="Prevent Cross-Domain Leakage"
                description="Prevent LLM from combining/synthesizing information across documents with different sensitivity levels"
                onChange={() => handleToggle("preventCrossDomain")}
              />

              {policies.preventLeakage && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-xs text-yellow-200">
                    ℹ️ <strong>How it works:</strong> Response is scanned for patterns like SQL queries, API endpoints,
                    file paths, database connection strings, and internal configuration that shouldn't be exposed to users.
                  </p>
                </div>
              )}
            </div>
          </RuleSectionCard>

          {/* Pro Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubscriptionLock
              title="Contextual Redaction"
              description="Intelligently redact only truly sensitive occurrences while preserving legitimate references"
              tier="Pro"
            />
            <SubscriptionLock
              title="Custom PII Patterns"
              description="Define custom regex patterns for organization-specific PII formats"
              tier="Pro"
            />
            <SubscriptionLock
              title="Paraphrase & Sanitize"
              description="Rephrase blocked content rather than simply removing it"
              tier="Enterprise"
            />
            <SubscriptionLock
              title="Sentiment Analysis"
              description="Analyze emotional tone and block responses that could cause harm"
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
    </div>
  );
}
