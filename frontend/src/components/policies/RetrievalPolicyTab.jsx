"use client";
import { useState } from "react";
import PolicyToggle from "./common/PolicyToggle";
import RuleSectionCard from "./common/RuleSectionCard";
import RangeSlider from "./common/RangeSlider";
import SubscriptionLock from "./common/SubscriptionLock";

export default function RetrievalPolicyTab({ onSaveSuccess, onSaveError }) {
  const [policies, setPolicies] = useState({
    enabled: true,
    similarityThreshold: 0.7,
    restrictByDepartment: true,
    restrictBySensitivity: true,
    restrictByDataSource: false,
    sensitivityLevels: ["low", "medium"],
    departments: ["engineering", "product"],
    dataSources: ["internal_docs"],
  });

  const [chunkFiltering, setChunkFiltering] = useState({
    enabled: true,
    minChunkSize: 50,
    maxChunkSize: 1000,
    removeMetadata: false,
  });

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

  const handleChunkChange = (key, value) => {
    setChunkFiltering((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleArrayItem = (key, item) => {
    setPolicies((prev) => ({
      ...prev,
      [key]: prev[key].includes(item)
        ? prev[key].filter((i) => i !== item)
        : [...prev[key], item],
    }));
  };

  const handleSave = async () => {
    try {
      console.log("Saving retrieval policy:", { policies, chunkFiltering });
      onSaveSuccess("Retrieval Policy updated successfully");
    } catch (err) {
      onSaveError("Failed to save Retrieval Policy");
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <RuleSectionCard
        title="Retrieval Filtering Status"
        icon="📂"
        description="Control which documents can be retrieved based on user attributes and document metadata"
      >
        <PolicyToggle
          enabled={policies.enabled}
          label="Enable Retrieval Policy"
          description="When enabled, document retrieval is restricted based on department, sensitivity, and source policies"
          onChange={() => handleToggle("enabled")}
        />
      </RuleSectionCard>

      {policies.enabled && (
        <>
          {/* Similarity Threshold */}
          <RuleSectionCard
            title="Semantic Similarity Threshold"
            icon="🎯"
            description="Only retrieve documents with similarity scores above this threshold"
          >
            <div className="space-y-4">
              <RangeSlider
                min={0}
                max={1}
                step={0.05}
                value={policies.similarityThreshold}
                onChange={(value) => handleChange("similarityThreshold", value)}
                label="Similarity Score"
                format={(val) => val.toFixed(2)}
              />
              <p className="text-xs text-gray-400">
                <strong>Example:</strong> Setting to 0.7 means only documents with 70%+ semantic match are retrieved.
                Higher values = more restrictive (fewer results), Lower values = more permissive (more results)
              </p>
            </div>
          </RuleSectionCard>

          {/* Sensitivity Restrictions */}
          <RuleSectionCard
            title="Sensitivity-Based Retrieval"
            icon="🔐"
            description="Restrict document retrieval based on document sensitivity classification"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={policies.restrictBySensitivity}
                label="Enforce Sensitivity Restrictions"
                description="Only allow retrieval of documents at or below user's clearance level"
                onChange={() => handleToggle("restrictBySensitivity")}
              />

              {policies.restrictBySensitivity && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Allowed Sensitivity Levels
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {["low", "medium", "high"].map((level) => (
                      <button
                        key={level}
                        onClick={() => toggleArrayItem("sensitivityLevels", level)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          policies.sensitivityLevels.includes(level)
                            ? "bg-blue-600 text-white"
                            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                        }`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </RuleSectionCard>

          {/* Department Restrictions */}
          <RuleSectionCard
            title="Department-Based Retrieval"
            icon="🏢"
            description="Limit document access to specific departments"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={policies.restrictByDepartment}
                label="Enforce Department Restrictions"
                description="Users can only retrieve documents from their assigned departments"
                onChange={() => handleToggle("restrictByDepartment")}
              />

              {policies.restrictByDepartment && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Enabled Departments
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {["engineering", "product", "sales", "finance", "legal"].map((dept) => (
                      <button
                        key={dept}
                        onClick={() => toggleArrayItem("departments", dept)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          policies.departments.includes(dept)
                            ? "bg-green-600 text-white"
                            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                        }`}
                      >
                        {dept.charAt(0).toUpperCase() + dept.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </RuleSectionCard>

          {/* Data Source Restrictions */}
          <RuleSectionCard
            title="Data Source Restrictions"
            icon="💾"
            description="Control which data sources can be accessed"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={policies.restrictByDataSource}
                label="Enforce Data Source Restrictions"
                description="Only allow retrieval from approved data sources"
                onChange={() => handleToggle("restrictByDataSource")}
              />

              {policies.restrictByDataSource && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Enabled Data Sources
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {["internal_docs", "customer_data", "public_kb", "api_responses", "logs"].map((source) => (
                      <button
                        key={source}
                        onClick={() => toggleArrayItem("dataSources", source)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          policies.dataSources.includes(source)
                            ? "bg-purple-600 text-white"
                            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                        }`}
                      >
                        {source.replace(/_/g, " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </RuleSectionCard>

          {/* Chunk Filtering */}
          <RuleSectionCard
            title="Document Chunk Filtering"
            icon="✂️"
            description="Configure how documents are split and processed for retrieval"
          >
            <div className="space-y-4">
              <PolicyToggle
                enabled={chunkFiltering.enabled}
                label="Enable Chunk Filtering"
                description="Apply size and metadata restrictions to document chunks"
                onChange={() =>
                  setChunkFiltering((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
              />

              {chunkFiltering.enabled && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RangeSlider
                    min={10}
                    max={500}
                    step={10}
                    value={chunkFiltering.minChunkSize}
                    onChange={(value) => handleChunkChange("minChunkSize", value)}
                    label="Minimum Chunk Size (tokens)"
                  />
                  <RangeSlider
                    min={500}
                    max={4000}
                    step={100}
                    value={chunkFiltering.maxChunkSize}
                    onChange={(value) => handleChunkChange("maxChunkSize", value)}
                    label="Maximum Chunk Size (tokens)"
                  />
                </div>
              )}

              <PolicyToggle
                enabled={chunkFiltering.removeMetadata}
                label="Remove Sensitive Metadata"
                description="Strip document metadata (source, author, timestamp) from retrieved chunks"
                onChange={() =>
                  setChunkFiltering((prev) => ({
                    ...prev,
                    removeMetadata: !prev.removeMetadata,
                  }))
                }
              />
            </div>
          </RuleSectionCard>

          {/* How It Works */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">How Retrieval Filtering Works</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• User submits query with their role/department/clearance attributes</li>
              <li>• System finds semantically similar documents (above similarity threshold)</li>
              <li>• Documents are filtered by sensitivity, department, and data source policies</li>
              <li>• Document chunks are processed (size filtered, metadata optionally removed)</li>
              <li>• Only approved documents are passed to the LLM for generation</li>
            </ul>
          </div>

          {/* Pro Features */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SubscriptionLock
              title="Dynamic Chunk Weighting"
              description="Assign relevance weights to chunks based on custom rules"
              tier="Pro"
            />
            <SubscriptionLock
              title="Cross-Document Synthesis Control"
              description="Restrict LLM from combining information across sensitive documents"
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
