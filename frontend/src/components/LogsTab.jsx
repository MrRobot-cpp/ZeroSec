import { useState, useMemo } from "react";
import PropTypes from "prop-types";
import { exportLogs } from "@/services/logsService";

export default function LogsTab({ logsData }) {
  const { filters, applyFilters, getFilteredLogs, loading } = logsData;
  const [searchInput, setSearchInput] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredLogs = useMemo(() => getFilteredLogs(), [getFilteredLogs]);

  const handleSearch = (value) => {
    setSearchInput(value);
    applyFilters({ search: value });
  };

  const handleFilterChange = (key, value) => {
    applyFilters({ [key]: value });
  };

  const handleExport = async (format) => {
    try {
      await exportLogs(format, filters);
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const openLogDetail = (log) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const getDecisionBadge = (decision) => {
    const decisionUpper = decision?.toUpperCase();
    if (decisionUpper === "ALLOW") {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-green-900/50 text-green-300">ALLOW</span>;
    }
    if (decisionUpper === "BLOCK") {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-red-900/50 text-red-300">BLOCK</span>;
    }
    return <span className="px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300">{decision || "N/A"}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search query, reason, or stopped by..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange("type", e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="query">Query Logs</option>
              <option value="ingestion">Document Ingestion</option>
              <option value="violation">Access Violations</option>
              <option value="retrieval">Retrieval Filtering</option>
            </select>
          </div>

          {/* Decision Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Decision
            </label>
            <select
              value={filters.decision}
              onChange={(e) => handleFilterChange("decision", e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Decisions</option>
              <option value="allow">Allow</option>
              <option value="block">Block</option>
            </select>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("json")}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gray-800 rounded-xl shadow border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-sm text-gray-400 bg-gray-900/50">
                <th className="py-4 px-6 font-medium">Timestamp</th>
                <th className="py-4 px-6 font-medium">Query</th>
                <th className="py-4 px-6 font-medium">Decision</th>
                <th className="py-4 px-6 font-medium">Reason</th>
                <th className="py-4 px-6 font-medium">Stopped By</th>
                <th className="py-4 px-6 font-medium">Score</th>
                <th className="py-4 px-6 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="animate-spin text-4xl">⟳</span>
                      <p className="text-gray-400">Loading logs...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl">🔍</span>
                      <p className="text-gray-400">No logs found</p>
                      <p className="text-sm text-gray-500">
                        Try adjusting your filters or search term
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.slice(0, 100).map((log, index) => (
                  <tr
                    key={index}
                    className="border-t border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => openLogDetail(log)}
                  >
                    <td className="py-4 px-6 text-gray-300 text-sm">
                      {log.timestamp
                        ? new Date(log.timestamp).toLocaleString()
                        : "N/A"}
                    </td>
                    <td className="py-4 px-6 text-gray-100 max-w-md truncate">
                      {log.query || log.Query || "N/A"}
                    </td>
                    <td className="py-4 px-6">{getDecisionBadge(log.decision)}</td>
                    <td className="py-4 px-6 text-gray-300 text-sm max-w-xs truncate">
                      {log.reason || "N/A"}
                    </td>
                    <td className="py-4 px-6 text-gray-300 text-sm">
                      {log.stopped_by || "N/A"}
                    </td>
                    <td className="py-4 px-6 text-gray-300 text-sm">
                      {log.score !== undefined ? log.score.toFixed(2) : "N/A"}
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openLogDetail(log);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredLogs.length > 100 && (
          <div className="bg-gray-900/50 px-6 py-3 border-t border-gray-700 text-center text-sm text-gray-400">
            Showing 100 of {filteredLogs.length} logs. Use filters to narrow results.
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-bold text-white">Log Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Timestamp
                </label>
                <p className="text-white">
                  {selectedLog.timestamp
                    ? new Date(selectedLog.timestamp).toLocaleString()
                    : "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Query
                </label>
                <p className="text-white bg-gray-900 p-3 rounded border border-gray-700">
                  {selectedLog.query || selectedLog.Query || "N/A"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Decision
                  </label>
                  {getDecisionBadge(selectedLog.decision)}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Score
                  </label>
                  <p className="text-white">
                    {selectedLog.score !== undefined
                      ? selectedLog.score.toFixed(2)
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Reason
                </label>
                <p className="text-white bg-gray-900 p-3 rounded border border-gray-700">
                  {selectedLog.reason || "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Stopped By
                </label>
                <p className="text-white">{selectedLog.stopped_by || "N/A"}</p>
              </div>

              {selectedLog.metadata && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Additional Metadata
                  </label>
                  <pre className="text-white bg-gray-900 p-3 rounded border border-gray-700 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

LogsTab.propTypes = {
  logsData: PropTypes.shape({
    filters: PropTypes.object.isRequired,
    applyFilters: PropTypes.func.isRequired,
    getFilteredLogs: PropTypes.func.isRequired,
    loading: PropTypes.bool.isRequired,
  }).isRequired,
};
