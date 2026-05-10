import { useState, useEffect, useCallback } from "react";
import { getLogsAndAlerts } from "@/services/logsService";

export default function useLogs() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: "all",
    decision: "all",
    search: "",
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLogsAndAlerts();

      // Handle both array and object responses from the API
      const allLogs = (Array.isArray(data) ? data : data.logs) || [];

      console.log(`[useLogs] fetched ${allLogs.length} logs from /logs`, {
        firstEntry: allLogs[0],
        url: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200",
      });

      // Logs are all entries
      setLogs(allLogs);

      // Alerts are blocked entries with specific reasons, plus all ML-detected anomalies
      const alertsData = allLogs
        .filter(
          (log) =>
            log.decision?.toUpperCase() === "BLOCK" ||
            log.decision?.toUpperCase() === "REDACTED" ||
            log.is_anomaly === true
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
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const getFilteredLogs = useCallback(() => {
    let filtered = [...logs];

    // Exclude health_check logs by default
    filtered = filtered.filter(
      (log) => (log.query || log.Query) !== "health_check"
    );

    // Filter by type
    if (filters.type && filters.type !== "all") {
      filtered = filtered.filter((log) => {
        const type = filters.type.toLowerCase();
        if (type === "query") return log.query || log.Query;
        if (type === "ingestion") return log.type === "ingestion";
        if (type === "violation") return log.decision === "BLOCK";
        if (type === "retrieval") return log.stopped_by?.includes("retrieval");
        return true;
      });
    }

    // Filter by decision
    if (filters.decision && filters.decision !== "all") {
      filtered = filtered.filter(
        (log) => log.decision?.toUpperCase() === filters.decision.toUpperCase()
      );
    }

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.query?.toLowerCase().includes(searchLower) ||
          log.reason?.toLowerCase().includes(searchLower) ||
          log.stopped_by?.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [logs, filters]);

  const getFilteredAlerts = useCallback(() => {
    let filtered = [...alerts];

    // Filter by alert type
    if (filters.alertType && filters.alertType !== "all") {
      filtered = filtered.filter(
        (alert) => alert.alertType === filters.alertType
      );
    }

    // Filter by severity
    if (filters.severity && filters.severity !== "all") {
      filtered = filtered.filter((alert) => alert.severity === filters.severity);
    }

    // Filter by search term
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (alert) =>
          alert.query?.toLowerCase().includes(searchLower) ||
          alert.reason?.toLowerCase().includes(searchLower) ||
          alert.stopped_by?.toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [alerts, filters]);

  useEffect(() => {
    fetchLogs();

    // Set up polling for real-time updates every 30 seconds
    const interval = setInterval(fetchLogs, 30000);

    return () => clearInterval(interval);
  }, [fetchLogs]);

  return {
    logs,
    alerts,
    loading,
    error,
    filters,
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
