/**
 * Policies Hook
 * Manages security policies CRUD operations
 */

import { useState, useEffect, useCallback } from 'react';
import policyService from '@/services/policyService';

export default function usePolicies() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    type: null,
    enabled_only: false
  });

  /**
   * Fetch all policies
   */
  const fetchPolicies = useCallback(async (customFilters = null) => {
    setLoading(true);
    setError(null);

    try {
      const filterParams = customFilters || filters;
      const data = await policyService.getPolicies(filterParams);
      setPolicies(data);
      return data;
    } catch (err) {
      console.error('Error fetching policies:', err);
      setPolicies([]); // Set empty array on error
      setError(err.message || 'Failed to load policies');
      // Don't throw - just return empty array
      return [];
    } finally {
      setLoading(false);
    }
  }, [filters]);

  /**
   * Get a single policy by ID
   */
  const getPolicy = useCallback(async (policyId) => {
    try {
      const policy = await policyService.getPolicy(policyId);
      return policy;
    } catch (err) {
      console.error('Error fetching policy:', err);
      throw err;
    }
  }, []);

  /**
   * Create a new policy
   */
  const createPolicy = useCallback(async (policyData) => {
    setLoading(true);
    setError(null);

    try {
      const newPolicy = await policyService.createPolicy(policyData);

      // Add to local state
      setPolicies(prev => [newPolicy, ...prev]);

      return newPolicy;
    } catch (err) {
      console.error('Error creating policy:', err);
      setError(err.message || 'Failed to create policy');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing policy
   */
  const updatePolicy = useCallback(async (policyId, policyData) => {
    setLoading(true);
    setError(null);

    try {
      const updatedPolicy = await policyService.updatePolicy(policyId, policyData);

      // Update local state
      setPolicies(prev =>
        prev.map(p => p.policy_id === policyId ? updatedPolicy : p)
      );

      return updatedPolicy;
    } catch (err) {
      console.error('Error updating policy:', err);
      setError(err.message || 'Failed to update policy');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a policy
   */
  const deletePolicy = useCallback(async (policyId) => {
    setLoading(true);
    setError(null);

    try {
      await policyService.deletePolicy(policyId);

      // Remove from local state
      setPolicies(prev => prev.filter(p => p.policy_id !== policyId));

      return true;
    } catch (err) {
      console.error('Error deleting policy:', err);
      setError(err.message || 'Failed to delete policy');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Toggle policy enabled status
   */
  const togglePolicy = useCallback(async (policyId) => {
    try {
      const updatedPolicy = await policyService.togglePolicy(policyId);

      // Update local state
      setPolicies(prev =>
        prev.map(p => p.policy_id === policyId ? updatedPolicy : p)
      );

      return updatedPolicy;
    } catch (err) {
      console.error('Error toggling policy:', err);
      throw err;
    }
  }, []);

  /**
   * Apply filters
   */
  const applyFilters = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Get policies by type
   */
  const getPoliciesByType = useCallback((policyType) => {
    return policies.filter(p => p.policy_type === policyType);
  }, [policies]);

  /**
   * Get enabled policies
   */
  const getEnabledPolicies = useCallback(() => {
    return policies.filter(p => p.enabled);
  }, [policies]);

  /**
   * Initial fetch on mount and when filters change
   */
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  return {
    policies,
    loading,
    error,
    filters,
    fetchPolicies,
    getPolicy,
    createPolicy,
    updatePolicy,
    deletePolicy,
    togglePolicy,
    applyFilters,
    getPoliciesByType,
    getEnabledPolicies,
    refresh: fetchPolicies
  };
}
