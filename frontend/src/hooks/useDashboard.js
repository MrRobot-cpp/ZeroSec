/**
 * Dashboard Hook
 * Fetches and manages dashboard metrics
 */

import { useState, useEffect, useCallback } from 'react';
import dashboardService from '@/services/dashboardService';

export default function useDashboard() {
  const [data, setData] = useState({
    overview: null,
    documents: null,
    security: null,
    users: null,
    policies: null,
    recentActivity: [],
    alerts: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  /**
   * Fetch all dashboard data
   */
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await dashboardService.refreshAll();

      setData({
        overview: result.overview || {},
        documents: result.documents || {},
        security: result.security || {},
        users: result.users || {},
        policies: result.policies || {},
        recentActivity: result.recentActivity || [],
        alerts: result.alerts || []
      });

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      // Set empty data on error instead of failing
      setData({
        overview: {},
        documents: {},
        security: {},
        users: {},
        policies: {},
        recentActivity: [],
        alerts: []
      });
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch specific section
   */
  const fetchSection = useCallback(async (section) => {
    try {
      let sectionData;

      switch (section) {
        case 'documents':
          sectionData = await dashboardService.getDocumentStats();
          break;
        case 'security':
          sectionData = await dashboardService.getSecurityStats();
          break;
        case 'users':
          sectionData = await dashboardService.getUserActivity();
          break;
        case 'policies':
          sectionData = await dashboardService.getPolicyStats();
          break;
        case 'recentActivity':
          sectionData = await dashboardService.getRecentActivity();
          break;
        case 'alerts':
          sectionData = await dashboardService.getAlerts();
          break;
        case 'overview':
          sectionData = await dashboardService.getOverview();
          break;
        default:
          throw new Error(`Unknown section: ${section}`);
      }

      setData(prev => ({
        ...prev,
        [section]: sectionData
      }));

      return sectionData;
    } catch (err) {
      console.error(`Error fetching ${section}:`, err);
      throw err;
    }
  }, []);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);

    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refresh: fetchDashboardData,
    refreshSection: fetchSection
  };
}
