const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Fetch all logs and alerts from the backend
 */
export async function getLogsAndAlerts() {
  try {
    const response = await fetch(`${API_BASE_URL}/logs`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching logs/alerts:", error);
    throw new Error(`Failed to fetch: ${error.message}`);
  }
}

/**
 * Filter logs based on criteria
 */
export async function filterLogs(filters) {
  try {
    const queryParams = new URLSearchParams();

    if (filters.type) queryParams.append("type", filters.type);
    if (filters.decision) queryParams.append("decision", filters.decision);
    if (filters.startDate) queryParams.append("startDate", filters.startDate);
    if (filters.endDate) queryParams.append("endDate", filters.endDate);
    if (filters.search) queryParams.append("search", filters.search);

    const response = await fetch(`${API_BASE_URL}/logs?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error filtering logs:", error);
    throw new Error(`Failed to filter: ${error.message}`);
  }
}

/**
 * Export logs in specified format
 */
export async function exportLogs(format = "csv", filters = {}) {
  try {
    const queryParams = new URLSearchParams({ format, ...filters });

    const response = await fetch(`${API_BASE_URL}/logs/export?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().split("T")[0]}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error("Error exporting logs:", error);
    throw new Error(`Failed to export: ${error.message}`);
  }
}

/**
 * Get alert details by ID
 */
export async function getAlertDetails(alertId) {
  try {
    const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching alert details:", error);
    throw new Error(`Failed to fetch alert: ${error.message}`);
  }
}

/**
 * Mark alert as resolved
 */
export async function resolveAlert(alertId) {
  try {
    const response = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error resolving alert:", error);
    throw new Error(`Failed to resolve alert: ${error.message}`);
  }
}
