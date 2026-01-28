/**
 * API Client
 * Wrapper around fetch that automatically adds authentication headers
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

class ApiClient {
  /**
   * Make an authenticated API request
   */
  async fetch(endpoint, options = {}) {
    // Get token from localStorage
    const token = this.getToken();

    // Prepare headers
    const headers = {
      ...options.headers,
    };

    // Add auth header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add Content-Type if not set and body is present
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Make request
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Unauthorized - please login again');
      }

      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST request
   */
  async post(endpoint, body, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, body, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.fetch(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Get token from localStorage
   */
  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zerosec_token');
    }
    return null;
  }

  /**
   * Handle unauthorized access
   */
  handleUnauthorized() {
    if (typeof window !== 'undefined') {
      // Clear token
      localStorage.removeItem('zerosec_token');
      localStorage.removeItem('zerosec_user');

      // Redirect to login (only if not already there)
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
  }
}

// Export singleton instance
const apiClient = new ApiClient();
export default apiClient;
