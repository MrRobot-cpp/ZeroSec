import { useState, useMemo } from "react";
import PropTypes from "prop-types";

export default function AlertsTab({ logsData }) {
  const { filters, applyFilters, getFilteredAlerts, loading } = logsData;
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const filteredAlerts = useMemo(() => getFilteredAlerts(), [getFilteredAlerts]);

  // Group alerts by type
  const alertsByType = useMemo(() => {
    return filteredAlerts.reduce((acc, alert) => {
      const type = alert.alertType || "other";
      if (!acc[type]) acc[type] = [];
      acc[type].push(alert);
      return acc;
    }, {});
  }, [filteredAlerts]);

  const alertTypeConfig = {
    canary: {
      label: "Canary Triggers",
      icon: "🐤",
      color: "text-yellow-400",
      bgColor: "bg-yellow-900/30",
      borderColor: "border-yellow-400",
    },
    jailbreak: {
      label: "Jailbreak Attempts",
      icon: "🔓",
      color: "text-red-400",
      bgColor: "bg-red-900/30",
      borderColor: "border-red-400",
    },
    leak: {
      label: "Data Leak Attempts",
      icon: "💧",
      color: "text-orange-400",
      bgColor: "bg-orange-900/30",
      borderColor: "border-orange-400",
    },
    suspicious: {
      label: "Suspicious Users",
      icon: "👤",
      color: "text-purple-400",
      bgColor: "bg-purple-900/30",
      borderColor: "border-purple-400",
    },
    other: {
      label: "Other Alerts",
      icon: "⚠️",
      color: "text-gray-400",
      bgColor: "bg-gray-700/30",
      borderColor: "border-gray-500",
    },
  };

  const getSeverityBadge = (severity) => {
    const severityStyles = {
      critical: "bg-red-900/50 text-red-300 border-red-500",
      high: "bg-orange-900/50 text-orange-300 border-orange-500",
      medium: "bg-yellow-900/50 text-yellow-300 border-yellow-500",
      low: "bg-blue-900/50 text-blue-300 border-blue-500",
    };

    return (
      <span
        className={`px-2 py-1 rounded text-xs font-medium border ${
          severityStyles[severity] || severityStyles.low
        }`}
      >
        {severity?.toUpperCase() || "LOW"}
      </span>
    );
  };

  const openAlertDetail = (alert) => {
    setSelectedAlert(alert);
    setShowDetailModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Alert Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(alertTypeConfig).map(([type, config]) => {
          const count = alertsByType[type]?.length || 0;
          return (
            <div
              key={type}
              className={`bg-gray-800 border border-gray-700 rounded-xl p-4 ${
                count > 0 ? "hover:border-gray-600 cursor-pointer" : ""
              } transition-colors`}
              onClick={() => count > 0 && applyFilters({ alertType: type })}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{config.label}</p>
                  <p className={`text-3xl font-bold ${config.color} mt-1`}>
                    {count}
                  </p>
                </div>
                <span className="text-4xl">{config.icon}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Alert Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Alert Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Alert Type
            </label>
            <select
              value={filters.alertType || "all"}
              onChange={(e) => applyFilters({ alertType: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Types</option>
              <option value="canary">Canary Triggers</option>
              <option value="jailbreak">Jailbreak Attempts</option>
              <option value="leak">Data Leak Attempts</option>
              <option value="suspicious">Suspicious Users</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Severity
            </label>
            <select
              value={filters.severity || "all"}
              onChange={(e) => applyFilters({ severity: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search
            </label>
            <input
              type="text"
              value={filters.search || ""}
              onChange={(e) => applyFilters({ search: e.target.value })}
              placeholder="Search alerts..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
            <span className="animate-spin text-4xl">⟳</span>
            <p className="text-gray-400 mt-3">Loading alerts...</p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
            <span className="text-5xl">✅</span>
            <p className="text-gray-400 mt-3">No alerts found</p>
            <p className="text-sm text-gray-500 mt-1">
              All systems operating normally
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert, index) => {
            const config = alertTypeConfig[alert.alertType] || alertTypeConfig.other;
            return (
              <div
                key={index}
                className={`bg-gray-800 border rounded-xl p-4 hover:bg-gray-700/50 cursor-pointer transition-colors ${config.borderColor}`}
                onClick={() => openAlertDetail(alert)}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`text-3xl p-3 rounded-lg ${config.bgColor} ${config.borderColor} border`}
                  >
                    {config.icon}
                  </div>

                  {/* Alert Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h4 className={`font-semibold ${config.color}`}>
                          {config.label}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {alert.timestamp
                            ? new Date(alert.timestamp).toLocaleString()
                            : "N/A"}
                        </p>
                      </div>
                      {getSeverityBadge(alert.severity)}
                    </div>

                    <p className="text-gray-100 mb-2 line-clamp-2">
                      {alert.query || alert.Query || "No query available"}
                    </p>

                    <div className="flex flex-wrap gap-2 text-sm">
                      {alert.reason && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded">
                          {alert.reason}
                        </span>
                      )}
                      {alert.stopped_by && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded">
                          Stopped by: {alert.stopped_by}
                        </span>
                      )}
                      {alert.score !== undefined && (
                        <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded">
                          Score: {alert.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openAlertDetail(alert);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Alert Detail Modal */}
      {showDetailModal && selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <span className="text-4xl">
                  {alertTypeConfig[selectedAlert.alertType]?.icon || "⚠️"}
                </span>
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {alertTypeConfig[selectedAlert.alertType]?.label || "Alert Details"}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedAlert.timestamp
                      ? new Date(selectedAlert.timestamp).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Severity
                  </label>
                  {getSeverityBadge(selectedAlert.severity)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Alert Type
                  </label>
                  <p className="text-white">{selectedAlert.alertType}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Query
                </label>
                <p className="text-white bg-gray-900 p-3 rounded border border-gray-700">
                  {selectedAlert.query || selectedAlert.Query || "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Reason
                </label>
                <p className="text-white bg-gray-900 p-3 rounded border border-gray-700">
                  {selectedAlert.reason || "N/A"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Stopped By
                  </label>
                  <p className="text-white">{selectedAlert.stopped_by || "N/A"}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Score
                  </label>
                  <p className="text-white">
                    {selectedAlert.score !== undefined
                      ? selectedAlert.score.toFixed(2)
                      : "N/A"}
                  </p>
                </div>
              </div>

              {selectedAlert.decision && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">
                    Decision
                  </label>
                  <p className="text-white">{selectedAlert.decision}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
              <button
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

AlertsTab.propTypes = {
  logsData: PropTypes.shape({
    filters: PropTypes.object.isRequired,
    applyFilters: PropTypes.func.isRequired,
    getFilteredAlerts: PropTypes.func.isRequired,
    loading: PropTypes.bool.isRequired,
  }).isRequired,
};
