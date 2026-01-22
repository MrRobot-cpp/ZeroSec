import { useState, useEffect } from "react";

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
      const response = await fetch("http://localhost:5200/documents");
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
    <div className="h-full p-3 bg-gray-800 border border-gray-700 rounded-xl shadow flex flex-col overflow-hidden">
      <h2 className="text-base font-semibold mb-3 text-white text-center">Data Intake Status</h2>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="animate-spin text-2xl mb-2">⏳</div>
            <p>Loading...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 text-center">
              <div className="text-3xl font-bold text-blue-400">{totalDocs}</div>
              <div className="text-sm text-gray-400">Total Docs</div>
            </div>
            <div className="bg-gray-900 p-3 rounded-lg border border-gray-700 text-center">
              <div className="text-3xl font-bold text-green-400">{recentDocs}</div>
              <div className="text-sm text-gray-400">New (24h)</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Total Size:</span>
              <span className="text-sm text-white font-semibold">{formatSize(totalSize)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Issues:</span>
              <span className={`text-sm font-semibold ${issueCount > 0 ? "text-orange-400" : "text-green-400"}`}>
                {issueCount}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Last Update:</span>
              <span className="text-sm text-gray-300">
                {documents.length > 0
                  ? new Date(documents[0].uploaded_at).toLocaleTimeString()
                  : "N/A"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Avg Doc Size:</span>
              <span className="text-sm text-gray-300">
                {totalDocs > 0 ? formatSize(totalSize / totalDocs) : "0 B"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-400">Status:</span>
              <span className={`text-sm font-semibold ${issueCount > 0 ? "text-orange-400" : "text-green-400"}`}>
                {issueCount > 0 ? "Issues Detected" : "Healthy"}
              </span>
            </div>
          </div>

          {issueCount > 0 && (
            <div className="mt-3 p-2 bg-orange-900/20 border border-orange-400 rounded-lg">
              <div className="text-sm text-orange-300">
                ⚠️ {issueCount} issue{issueCount > 1 ? "s" : ""} detected
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
