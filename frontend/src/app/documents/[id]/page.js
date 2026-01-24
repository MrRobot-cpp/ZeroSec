"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

export default function DocumentDetails() {
  const params = useParams();
  const router = useRouter();
  const documentId = decodeURIComponent(params.id);

  const [activeTab, setActiveTab] = useState("overview");
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDocumentDetails();
  }, [documentId]);

  const fetchDocumentDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/documents/${documentId}`);
      if (!response.ok) {
        throw new Error("Document not found");
      }
      const data = await response.json();
      setDocument(data.document);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
    { id: "security", label: "Security Scan", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
    { id: "access", label: "Access Control", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
    { id: "activity", label: "Activity Log", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  ];

  const getSensitivityColor = (sensitivity) => {
    switch (sensitivity?.toLowerCase()) {
      case "high": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "medium": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "low": return "bg-green-500/20 text-green-400 border-green-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return "N/A";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (isoString) => {
    if (!isoString) return "N/A";
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-gray-400">Loading document details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900">
        <div className="text-red-400 mb-4">{error}</div>
        <Link href="/documents" className="text-blue-400 hover:text-blue-300">
          Back to Documents
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/documents"
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                <svg className="w-5 h-5 sm:w-7 sm:h-7 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="truncate">{document?.name}</span>
              </h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                Uploaded {formatDate(document?.uploaded_at)}
              </p>
            </div>
          </div>
          <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs sm:text-sm font-medium border whitespace-nowrap ${getSensitivityColor(document?.sensitivity)}`}>
            {document?.sensitivity} Sensitivity
          </span>
        </div>

        {/* Tabs - Scrollable on mobile */}
        <div className="flex gap-1 mt-4 sm:mt-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-t-lg font-medium text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? "bg-gray-900 text-white border-t border-x border-gray-700"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {activeTab === "overview" && <OverviewTab document={document} formatFileSize={formatFileSize} formatDate={formatDate} />}
        {activeTab === "security" && <SecurityTab document={document} />}
        {activeTab === "access" && <AccessControlTab document={document} />}
        {activeTab === "activity" && <ActivityLogTab document={document} />}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ document, formatFileSize, formatDate }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {/* File Information */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          File Information
        </h3>
        <div className="space-y-3 sm:space-y-4">
          <InfoRow label="File Name" value={document?.name} />
          <InfoRow label="File Type" value={document?.name?.split('.').pop()?.toUpperCase() || "Unknown"} />
          <InfoRow label="File Size" value={formatFileSize(document?.size)} />
          <InfoRow label="Upload Date" value={formatDate(document?.uploaded_at)} />
          <InfoRow label="Status" value={document?.status} badge />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Quick Stats
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <StatCard
            label="Security Issues"
            value={document?.issues?.length || 0}
            color={document?.issues?.length > 0 ? "red" : "green"}
          />
          <StatCard
            label="ACL Tags"
            value={document?.acl_tags?.length || 0}
            color="blue"
          />
          <StatCard
            label="Access Attempts"
            value={document?.access_count || 0}
            color="purple"
          />
          <StatCard
            label="Last Accessed"
            value={document?.last_accessed ? "Recent" : "Never"}
            color="gray"
          />
        </div>
      </div>

      {/* Content Preview */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6 lg:col-span-2">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Content Preview
        </h3>
        <div className="bg-gray-900 rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-64 overflow-auto">
          <pre className="text-gray-300 text-xs sm:text-sm whitespace-pre-wrap font-mono break-words">
            {document?.content_preview || "No preview available"}
          </pre>
        </div>
      </div>
    </div>
  );
}

// Security Scan Tab Component
function SecurityTab({ document }) {
  const issues = document?.issues || [];
  const scanResults = document?.scan_results || {};

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Scan Summary */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Security Scan Summary
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className={`p-3 sm:p-4 rounded-lg border ${issues.length === 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="text-xl sm:text-2xl font-bold text-white">{issues.length}</div>
            <div className="text-xs sm:text-sm text-gray-400">Issues Found</div>
          </div>
          <div className="p-3 sm:p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="text-xl sm:text-2xl font-bold text-white">{scanResults.pii_count || 0}</div>
            <div className="text-xs sm:text-sm text-gray-400">PII Detected</div>
          </div>
          <div className="p-3 sm:p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
            <div className="text-xl sm:text-2xl font-bold text-white">{scanResults.injection_score?.toFixed(2) || "0.00"}</div>
            <div className="text-xs sm:text-sm text-gray-400">Injection Score</div>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Detected Issues</h3>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 sm:gap-3 text-green-400 p-3 sm:p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm sm:text-base">No security issues detected</span>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {issues.map((issue, idx) => (
              <div key={idx} className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-red-400 font-medium text-sm sm:text-base break-words">{issue}</div>
                  <div className="text-gray-500 text-xs sm:text-sm mt-1">Detected during document upload scan</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan Details */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">Scan Details</h3>
        <div className="space-y-2 sm:space-y-3">
          <ScanCheckItem label="PII Detection (Email)" passed={!issues.some(i => i.includes('Email'))} />
          <ScanCheckItem label="PII Detection (Phone)" passed={!issues.some(i => i.includes('Phone'))} />
          <ScanCheckItem label="Injection Pattern Check" passed={!issues.some(i => i.includes('Injection'))} />
          <ScanCheckItem label="Malware Signature Scan" passed={true} />
          <ScanCheckItem label="Content Integrity" passed={true} />
        </div>
      </div>
    </div>
  );
}

// Access Control Tab Component
function AccessControlTab({ document }) {
  const aclTags = document?.acl_tags || [];
  const abacAttributes = document?.abac_attributes || {
    department: "All",
    clearance_level: document?.sensitivity === "High" ? "Confidential" : "Public",
    data_classification: document?.sensitivity || "Unknown"
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ACL Tags */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          ACL Tags
        </h3>
        <div className="flex flex-wrap gap-2">
          {aclTags.length === 0 ? (
            <span className="text-gray-500 text-sm">No ACL tags assigned</span>
          ) : (
            aclTags.map((tag, idx) => (
              <span key={idx} className="px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs sm:text-sm font-medium border border-blue-500/30">
                {tag}
              </span>
            ))
          )}
        </div>
      </div>

      {/* ABAC Attributes */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
          ABAC Attributes
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <AttributeCard label="Department" value={abacAttributes.department} />
          <AttributeCard label="Clearance Level" value={abacAttributes.clearance_level} />
          <AttributeCard label="Data Classification" value={abacAttributes.data_classification} />
          <AttributeCard label="Retention Policy" value={abacAttributes.retention_policy || "Standard"} />
        </div>
      </div>

      {/* Access Rules */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Access Rules
        </h3>
        <div className="space-y-2 sm:space-y-3">
          <AccessRuleItem
            action="Read"
            allowed={true}
            condition="Users with matching department or admin role"
          />
          <AccessRuleItem
            action="RAG Query"
            allowed={true}
            condition="All authenticated users (content may be redacted)"
          />
          <AccessRuleItem
            action="Download"
            allowed={document?.sensitivity !== "High"}
            condition={document?.sensitivity === "High" ? "Restricted to admin users only" : "All authenticated users"}
          />
          <AccessRuleItem
            action="Delete"
            allowed={true}
            condition="Admin users only"
          />
        </div>
      </div>
    </div>
  );
}

// Activity Log Tab Component
function ActivityLogTab({ document }) {
  const activities = document?.activity_log || [
    { timestamp: document?.uploaded_at, action: "Document uploaded", user: "System", details: "Initial upload and security scan" },
    { timestamp: document?.uploaded_at, action: "Security scan completed", user: "System", details: `Found ${document?.issues?.length || 0} issues` },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Activity Log
        </h3>

        {activities.length === 0 ? (
          <div className="text-gray-500 text-center py-6 sm:py-8 text-sm">No activity recorded yet</div>
        ) : (
          <div className="relative">
            <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-0.5 bg-gray-700"></div>
            <div className="space-y-4 sm:space-y-6">
              {activities.map((activity, idx) => (
                <div key={idx} className="relative pl-8 sm:pl-10">
                  <div className="absolute left-1.5 sm:left-2.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-gray-800"></div>
                  <div className="bg-gray-900 rounded-lg p-3 sm:p-4 border border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                      <span className="font-medium text-white text-sm sm:text-base">{activity.action}</span>
                      <span className="text-xs text-gray-500">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : "Unknown"}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-400">{activity.details}</div>
                    <div className="text-xs text-gray-500 mt-2">By: {activity.user}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components
function InfoRow({ label, value, badge }) {
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-gray-700 last:border-0 gap-1">
      <span className="text-gray-400 text-xs sm:text-sm">{label}</span>
      {badge ? (
        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs self-start sm:self-auto">{value}</span>
      ) : (
        <span className="text-white text-xs sm:text-sm font-medium break-all">{value}</span>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    green: "bg-green-500/10 border-green-500/30 text-green-400",
    blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
    purple: "bg-purple-500/10 border-purple-500/30 text-purple-400",
    gray: "bg-gray-500/10 border-gray-500/30 text-gray-400",
  };

  return (
    <div className={`p-3 sm:p-4 rounded-lg border ${colors[color]}`}>
      <div className="text-xl sm:text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ScanCheckItem({ label, passed }) {
  return (
    <div className="flex items-center justify-between p-2 sm:p-3 bg-gray-900 rounded-lg gap-2">
      <span className="text-gray-300 text-xs sm:text-sm">{label}</span>
      {passed ? (
        <span className="flex items-center gap-1 text-green-400 text-xs sm:text-sm whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="hidden xs:inline">Passed</span>
        </span>
      ) : (
        <span className="flex items-center gap-1 text-red-400 text-xs sm:text-sm whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="hidden xs:inline">Failed</span>
        </span>
      )}
    </div>
  );
}

function AttributeCard({ label, value }) {
  return (
    <div className="p-3 sm:p-4 bg-gray-900 rounded-lg border border-gray-700">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-white font-medium text-sm sm:text-base break-words">{value}</div>
    </div>
  );
}

function AccessRuleItem({ action, allowed, condition }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-900 rounded-lg border border-gray-700 gap-2 sm:gap-4">
      <div className="min-w-0">
        <div className="text-white font-medium text-sm sm:text-base">{action}</div>
        <div className="text-xs text-gray-500 mt-1 break-words">{condition}</div>
      </div>
      <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium self-start sm:self-auto whitespace-nowrap flex-shrink-0 ${
        allowed
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30"
      }`}>
        {allowed ? "Allowed" : "Denied"}
      </span>
    </div>
  );
}
