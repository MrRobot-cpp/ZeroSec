import { useState, useEffect, useCallback } from "react";
import { getLogsAndAlerts } from "@/services/logsService";

export default function useLogs() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Separate filter state for each tab so they never interfere with each other.
  const [logFilters, setLogFilters] = useState({
    type: "all",
    decision: "all",
    search: "",
  });
  const [alertFilters, setAlertFilters] = useState({
    alertType: "all",
    severity: "all",
    search: "",
  });

  // Merged view exposed as `filters` for components that read both tabs' state
  // (e.g. LogsAndAlerts header). Alert-specific keys are on alertFilters;
  // log-specific keys are on logFilters.
  const filters = { ...logFilters, ...alertFilters };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLogsAndAlerts();

      // Handle both array and object responses from the API
      const allLogs = (Array.isArray(data) ? data : data.logs) || [];

      // Logs are all entries
      setLogs(allLogs);

      // Alerts are blocked entries with specific reasons, plus all ML-detected anomalies
      const alertsData = allLogs
        .filter(
          (log) =>
            log.decision?.toUpperCase() === "BLOCK" || log.is_anomaly === true
        )
        .map((log) => ({
          ...log,
          alertType: categorizeAlert(log.reason, log.stopped_by, log.is_anomaly),
          severity: calculateSeverity(log.reason, log.stopped_by, log.anomaly_score),
        }));

      setAlerts(alertsData);
    } catch (err) {
      setError(err.message);
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const applyFilters = useCallback((newFilters) => {
    // Route alert-specific keys to alertFilters, everything else to logFilters
    const alertKeys = ["alertType", "severity"];
    const isAlertFilter = Object.keys(newFilters).some((k) =>
      alertKeys.includes(k)
    );

    if (isAlertFilter) {
      // If the caller also sent `search`, treat it as the alert search
      setAlertFilters((prev) => ({ ...prev, ...newFilters }));
    } else {
      setLogFilters((prev) => ({ ...prev, ...newFilters }));
    }
  }, []);

  const getFilteredLogs = useCallback(() => {
    let filtered = [...logs];

    // Exclude health_check logs by default
    filtered = filtered.filter(
      (log) => (log.query || log.Query) !== "health_check"
    );

    // Filter by type
    if (logFilters.type && logFilters.type !== "all") {
      filtered = filtered.filter((log) => {
        const type = logFilters.type.toLowerCase();
        if (type === "query") return log.query || log.Query;
        if (type === "ingestion") return log.type === "ingestion";
        if (type === "violation") return log.decision === "BLOCK";
        if (type === "retrieval") return log.stopped_by?.includes("retrieval");
        return true;
      });
    }

    // Filter by decision
    if (logFilters.decision && logFilters.decision !== "all") {
      filtered = filtered.filter(
        (log) => log.decision?.toUpperCase() === logFilters.decision.toUpperCase()
      );
    }

    // Filter by search term (logs-only search)
    if (logFilters.search) {
      const searchLower = logFilters.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.query?.toLowerCase().includes(searchLower) ||
          log.reason?.toLowerCase().includes(searchLower) ||
          log.stopped_by?.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [logs, logFilters]);

  const getFilteredAlerts = useCallback(() => {
    let filtered = [...alerts];

    // Filter by alert type
    if (alertFilters.alertType && alertFilters.alertType !== "all") {
      filtered = filtered.filter(
        (alert) => alert.alertType === alertFilters.alertType
      );
    }

    // Filter by severity
    if (alertFilters.severity && alertFilters.severity !== "all") {
      filtered = filtered.filter((alert) => alert.severity === alertFilters.severity);
    }

    // Filter by search term (alerts-only search)
    if (alertFilters.search) {
      const searchLower = alertFilters.search.toLowerCase();
      filtered = filtered.filter(
        (alert) =>
          alert.query?.toLowerCase().includes(searchLower) ||
          alert.reason?.toLowerCase().includes(searchLower) ||
          alert.stopped_by?.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [alerts, alertFilters]);

  useEffect(() => {
    fetchLogs();

    // Set up polling for real-time updates every 5 seconds
    const interval = setInterval(fetchLogs, 5000);

    return () => clearInterval(interval);
  }, [fetchLogs]);

  return {
    logs,
    alerts,
    loading,
    error,
    filters,          // merged view (backwards compat)
    logFilters,       // Logs-tab specific filters
    alertFilters,     // Alerts-tab specific filters
    applyFilters,
    getFilteredLogs,
    getFilteredAlerts,
    refreshLogs: fetchLogs,
  };
}

/**
 * Categorize alert based on reason, stopped_by, and ML anomaly flag.
 */
function categorizeAlert(reason, stoppedBy, isAnomaly) {
  const reasonLower = reason?.toLowerCase() || "";
  const stoppedByLower = stoppedBy?.toLowerCase() || "";

  // ML-detected anomaly — explicit category so it renders separately from
  // rule-based "suspicious" entries.
  if (
    isAnomaly ||
    stoppedByLower.includes("anomaly detection") ||
    reasonLower.includes("anomaly:")
  ) {
    return "anomaly";
  }
  if (
    reasonLower.includes("canary") ||
    reasonLower.includes("insider threat") ||
    stoppedByLower.includes("canary")
  ) {
    return "canary";
  }
  if (
    reasonLower.includes("injection") ||
    reasonLower.includes("jailbreak") ||
    stoppedByLower.includes("jailbreak")
  ) {
    return "jailbreak";
  }
  if (
    reasonLower.includes("pii") ||
    reasonLower.includes("leak") ||
    reasonLower.includes("data leak")
  ) {
    return "leak";
  }
  if (
    reasonLower.includes("suspicious") ||
    reasonLower.includes("unusual")
  ) {
    return "suspicious";
  }

  return "other";
}

/**
 * Calculate severity. For ML anomalies the score drives severity directly;
 * for rule-based blocks we fall back to reason/stopped_by heuristics.
 */
function calculateSeverity(reason, stoppedBy, anomalyScore) {
  // Score-based severity when the anomaly detector has a value
  if (typeof anomalyScore === "number") {
    if (anomalyScore >= 0.9) return "critical";
    if (anomalyScore >= 0.75) return "high";
    if (anomalyScore >= 0.45) return "medium";
  }

  const reasonLower = reason?.toLowerCase() || "";
  const stoppedByLower = stoppedBy?.toLowerCase() || "";

  // Critical severity
  if (
    reasonLower.includes("injection") ||
    reasonLower.includes("jailbreak") ||
    reasonLower.includes("data leak")
  ) {
    return "critical";
  }

  // High severity
  if (
    reasonLower.includes("pii") ||
    reasonLower.includes("canary") ||
    reasonLower.includes("insider threat") ||
    stoppedByLower.includes("canary")
  ) {
    return "high";
  }

  // Medium severity
  if (reasonLower.includes("suspicious") || reasonLower.includes("anomaly")) {
    return "medium";
  }

  return "low";
}
