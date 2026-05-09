import { useState, useEffect } from "react";
import apiClient from "../services/apiClient";

export default function DataIntakeStatus() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDocuments, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await apiClient.get("/documents");
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalDocs = documents.length;
  const recentDocs = documents.filter((doc) => {
    const uploadTime = new Date(doc.uploaded_at);
    const now = new Date();
    const hoursDiff = (now - uploadTime) / (1000 * 60 * 60);
    return hoursDiff <= 24;
  }).length;

  const totalSize = documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
  const formatSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const issueCount = documents.filter((doc) => doc.issues && doc.issues.length > 0).length;

  return (
    <div className="h-full p-5 bg-[#111827] border border-gray-800 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden group transition-all duration-500 hover:border-gray-700 min-h-0">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full pointer-events-none transition-opacity duration-1000"></div>

      <h2 className="text-lg font-semibold mb-4 text-gray-100 tracking-tight flex items-center justify-between relative z-10">
        Data Intake
        {issueCount > 0 ? (
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-orange-400 bg-orange-500/10 border border-orange-500/30 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block shadow-[0_0_5px_rgba(249,115,22,0.8)]"></span>
            Issues Detected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
            Healthy
          </span>
        )}
      </h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="animate-spin text-2xl mb-2 opacity-50">⏳</div>
            <p className="font-medium text-gray-400">Loading metrics...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative z-10 min-h-0">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-900/60 backdrop-blur-md p-4 rounded-xl border border-gray-800/80 text-center transition-all duration-300 hover:bg-gray-800/80 hover:border-gray-700 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent"></div>
              <div className="text-3xl font-bold text-blue-400 relative z-10" style={{ textShadow: "0 0 15px rgba(96,165,250,0.3)" }}>{totalDocs}</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1 relative z-10">Total Docs</div>
            </div>
            <div className="bg-gray-900/60 backdrop-blur-md p-4 rounded-xl border border-gray-800/80 text-center transition-all duration-300 hover:bg-gray-800/80 hover:border-gray-700 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"></div>
              <div className="text-3xl font-bold text-emerald-400 relative z-10" style={{ textShadow: "0 0 15px rgba(52,211,153,0.3)" }}>{recentDocs}</div>
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1 relative z-10">New (24h)</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-3 bg-gray-900/30 p-4 rounded-xl border border-gray-800/50">
            <div className="flex justify-between items-center pb-2 border-b border-gray-800/80">
              <span className="text-xs text-gray-500 font-medium">Total Size</span>
              <span className="text-sm text-gray-200 font-semibold">{formatSize(totalSize)}</span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-gray-800/80">
              <span className="text-xs text-gray-500 font-medium">Avg Doc Size</span>
              <span className="text-sm text-gray-300">
                {totalDocs > 0 ? formatSize(totalSize / totalDocs) : "0 B"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Last Sync</span>
              <span className="text-[11px] font-mono text-gray-400 bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-700/50">
                {documents.length > 0
                  ? new Date(documents[0].uploaded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : "N/A"}
              </span>
            </div>
          </div>

          {issueCount > 0 && (
            <div className="mt-3 p-3 bg-orange-900/20 border border-orange-500/30 rounded-xl backdrop-blur-sm flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-orange-400">Attention Required</div>
                <div className="text-xs text-orange-300/80 mt-0.5">{issueCount} document{issueCount > 1 ? "s" : ""} reported issues</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
