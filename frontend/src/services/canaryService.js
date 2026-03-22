/**
 * Canary Token Service
 * Handles canary token watermarking and management
 */

import apiClient from './apiClient';

const API_URL = 'http://localhost:5200/canary/watermark';

class CanaryService {
  /**
   * Watermark a document with a canary token
   * @param {File} file - The file to watermark
   * @returns {Promise<Object>} - Watermarked file blob and metadata
   */
  async watermarkDocument(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errMsg = 'Failed to watermark document.';
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const canaryId = res.headers.get('X-Canary-ID');
      const outputPath = res.headers.get('X-Output-Path');
      const canaryHash = res.headers.get('X-Canary-Hash');

      let filename = 'watermarked_file';
      const contentDisp = res.headers.get('Content-Disposition');
      if (contentDisp) {
        const match = contentDisp.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      return {
        blob,
        filename,
        canaryId,
        outputPath,
        canaryHash
      };
    } catch (error) {
      console.error('Error watermarking document:', error);
      throw error;
    }
  }

  /**
   * Get all canary tokens for the user's organization
   * @returns {Promise<Array>} - Array of canary tokens
   */
  async getCanaryTokens() {
    try {
      const response = await apiClient.get('/api/canary/tokens');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch canary tokens');
      }

      const data = await response.json();
      return data.tokens || [];
    } catch (error) {
      console.error('Error fetching canary tokens:', error);
      throw error;
    }
  }

  /**
   * Get all triggered canary tokens
   * @returns {Promise<Array>} - Array of triggered canary tokens
   */
  async getTriggeredTokens() {
    try {
      const response = await apiClient.get('/api/canary/tokens/triggered');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch triggered tokens');
      }

      const data = await response.json();
      return data.triggered_tokens || [];
    } catch (error) {
      console.error('Error fetching triggered tokens:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a canary token (for testing)
   * @param {string} tokenHash - The hash of the canary token
   * @returns {Promise<Object>} - Trigger response
   */
  async triggerToken(tokenHash) {
    try {
      const response = await apiClient.post(`/api/canary/trigger/${tokenHash}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger canary token');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error triggering canary token:', error);
      throw error;
    }
  }

  /**
   * Get canary token statistics
   * @returns {Promise<Object>} - Canary token statistics
   */
  async getCanaryStats() {
    try {
      const tokens = await this.getCanaryTokens();
      const triggered = tokens.filter(t => t.is_triggered);

      return {
        total: tokens.length,
        triggered: triggered.length,
        active: tokens.length - triggered.length,
        triggerRate: tokens.length > 0
          ? ((triggered.length / tokens.length) * 100).toFixed(1)
          : 0
      };
    } catch (error) {
      console.error('Error fetching canary stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
const canaryService = new CanaryService();

// Export both the instance and individual methods for backwards compatibility
export default canaryService;
export const { watermarkDocument, getCanaryTokens, getTriggeredTokens, triggerToken } = canaryService;
