/**
 * Dashboard Service
 * Provides metrics and statistics for the dashboard UI
 */

import apiClient from './apiClient';

class DashboardService {
  /**
   * Get complete dashboard overview with all metrics
   * @returns {Promise<Object>} - Dashboard overview data
   */
  async getOverview() {
    try {
      const response = await apiClient.get('/api/dashboard/overview');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch dashboard overview');
      }

      const data = await response.json();
      return {
        documents: data.documents || {},
        security: data.security || {},
        users: data.users || {},
        policies: data.policies || {},
        system: data.system || {}
      };
    } catch (error) {
      console.error('Error fetching dashboard overview:', error);
      // Return empty structure instead of throwing
      return {
        documents: {},
        security: {},
        users: {},
        policies: {},
        system: {}
      };
    }
  }

  /**
   * Get document statistics
   * @returns {Promise<Object>} - Document statistics
   */
  async getDocumentStats() {
    try {
      const response = await apiClient.get('/api/dashboard/documents');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch document stats');
      }

      const data = await response.json();
      return data.stats || {};
    } catch (error) {
      console.error('Error fetching document stats:', error);
      // Return empty object instead of throwing
      return {};
    }
  }

  /**
   * Get security statistics
   * @returns {Promise<Object>} - Security statistics
   */
  async getSecurityStats() {
    try {
      const response = await apiClient.get('/api/dashboard/security');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch security stats');
      }

      const data = await response.json();
      return data.stats || {};
    } catch (error) {
      console.error('Error fetching security stats:', error);
      // Return empty object instead of throwing
      return {};
    }
  }

  /**
   * Get user activity statistics
   * @returns {Promise<Object>} - User activity statistics
   */
  async getUserActivity() {
    try {
      const response = await apiClient.get('/api/dashboard/users');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch user activity');
      }

      const data = await response.json();
      return data.stats || {};
    } catch (error) {
      console.error('Error fetching user activity:', error);
      // Return empty object instead of throwing
      return {};
    }
  }

  /**
   * Get policy statistics
   * @returns {Promise<Object>} - Policy statistics
   */
  async getPolicyStats() {
    try {
      const response = await apiClient.get('/api/dashboard/policies');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policy stats');
      }

      const data = await response.json();
      return data.stats || {};
    } catch (error) {
      console.error('Error fetching policy stats:', error);
      // Return empty object instead of throwing
      return {};
    }
  }

  /**
   * Get recent activity (audit logs)
   * @param {number} limit - Maximum number of activities to fetch
   * @returns {Promise<Array>} - Array of recent activities
   */
  async getRecentActivity(limit = 10) {
    try {
      const response = await apiClient.get(`/api/dashboard/audit?limit=${limit}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch recent activity');
      }

      const data = await response.json();
      return data.logs || [];
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get security alerts
   * @param {string} status - Filter by status (open, closed, all)
   * @returns {Promise<Array>} - Array of security alerts
   */
  async getAlerts(status = 'all') {
    try {
      const endpoint = status === 'all'
        ? '/api/dashboard/alerts'
        : `/api/dashboard/alerts?status=${status}`;

      const response = await apiClient.get(endpoint);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch alerts');
      }

      const data = await response.json();
      return data.alerts || [];
    } catch (error) {
      console.error('Error fetching alerts:', error);
      // Return empty array instead of throwing
      return [];
    }
  }

  /**
   * Get system health status
   * @returns {Promise<Object>} - System health metrics
   */
  async getSystemHealth() {
    try {
      const response = await apiClient.get('/api/dashboard/health');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch system health');
      }

      const data = await response.json();
      return data.health || {};
    } catch (error) {
      console.error('Error fetching system health:', error);
      // Return empty object instead of throwing
      return {};
    }
  }

  /**
   * Refresh all dashboard data
   * Fetches all metrics in parallel
   * @returns {Promise<Object>} - All dashboard data
   */
  async refreshAll() {
    try {
      const [
        overview,
        documents,
        security,
        users,
        policies,
        recentActivity,
        alerts
      ] = await Promise.all([
        this.getOverview().catch(err => ({ documents: {}, security: {}, users: {}, policies: {}, system: {} })),
        this.getDocumentStats().catch(err => ({})),
        this.getSecurityStats().catch(err => ({})),
        this.getUserActivity().catch(err => ({})),
        this.getPolicyStats().catch(err => ({})),
        this.getRecentActivity().catch(err => []),
        this.getAlerts().catch(err => [])
      ]);

      return {
        overview,
        documents,
        security,
        users,
        policies,
        recentActivity,
        alerts,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      // Return empty data structure instead of throwing
      return {
        overview: { documents: {}, security: {}, users: {}, policies: {}, system: {} },
        documents: {},
        security: {},
        users: {},
        policies: {},
        recentActivity: [],
        alerts: [],
        lastUpdated: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const dashboardService = new DashboardService();
export default dashboardService;
