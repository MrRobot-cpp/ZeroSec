/**
 * Policy Management Service
 * Handles communication with backend policy endpoints
 */

import apiClient from './apiClient';

class PolicyService {
  /**
   * Get all policies for the user's organization
   * @param {Object} filters - Optional filters (type, enabled_only)
   * @returns {Promise<Array>} - Array of policies
   */
  async getPolicies(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.enabled_only) params.append('enabled_only', 'true');

      const queryString = params.toString();
      const endpoint = queryString ? `/api/policies?${queryString}` : '/api/policies';

      const response = await apiClient.get(endpoint);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policies');
      }

      const data = await response.json();
      return data.policies || [];
    } catch (error) {
      console.error('Error fetching policies:', error);
      throw error;
    }
  }

  /**
   * Get a single policy by ID
   * @param {number} policyId - Policy ID
   * @returns {Promise<Object>} - Policy object
   */
  async getPolicy(policyId) {
    try {
      const response = await apiClient.get(`/api/policies/${policyId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch policy');
      }

      const data = await response.json();
      return data.policy;
    } catch (error) {
      console.error('Error fetching policy:', error);
      throw error;
    }
  }

  /**
   * Create a new policy
   * @param {Object} policyData - Policy data
   * @param {string} policyData.policy_name - Policy name
   * @param {string} policyData.policy_type - Policy type (Security, Access, Data, etc.)
   * @param {Object} policyData.policy_config - Policy configuration
   * @param {boolean} policyData.enabled - Whether policy is enabled
   * @returns {Promise<Object>} - Created policy
   */
  async createPolicy(policyData) {
    try {
      const response = await apiClient.post('/api/policies', policyData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create policy');
      }

      const data = await response.json();
      return data.policy;
    } catch (error) {
      console.error('Error creating policy:', error);
      throw error;
    }
  }

  /**
   * Update an existing policy
   * @param {number} policyId - Policy ID
   * @param {Object} policyData - Updated policy data
   * @returns {Promise<Object>} - Updated policy
   */
  async updatePolicy(policyId, policyData) {
    try {
      const response = await apiClient.put(`/api/policies/${policyId}`, policyData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update policy');
      }

      const data = await response.json();
      return data.policy;
    } catch (error) {
      console.error('Error updating policy:', error);
      throw error;
    }
  }

  /**
   * Delete a policy
   * @param {number} policyId - Policy ID
   * @returns {Promise<Object>} - Deletion response
   */
  async deletePolicy(policyId) {
    try {
      const response = await apiClient.delete(`/api/policies/${policyId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete policy');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting policy:', error);
      throw error;
    }
  }

  /**
   * Toggle policy enabled status
   * @param {number} policyId - Policy ID
   * @returns {Promise<Object>} - Updated policy
   */
  async togglePolicy(policyId) {
    try {
      const response = await apiClient.post(`/api/policies/${policyId}/toggle`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle policy');
      }

      const data = await response.json();
      return data.policy;
    } catch (error) {
      console.error('Error toggling policy:', error);
      throw error;
    }
  }

  /**
   * Get policies by type
   * @param {string} policyType - Policy type
   * @returns {Promise<Array>} - Array of policies
   */
  async getPoliciesByType(policyType) {
    return this.getPolicies({ type: policyType });
  }

  /**
   * Get only enabled policies
   * @returns {Promise<Array>} - Array of enabled policies
   */
  async getEnabledPolicies() {
    return this.getPolicies({ enabled_only: true });
  }
}

// Export singleton instance
const policyService = new PolicyService();
export default policyService;
