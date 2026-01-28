/**
 * Authentication Service
 * Handles login, signup, logout, and token management
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

class AuthService {
  constructor() {
    this.TOKEN_KEY = 'zerosec_token';
    this.USER_KEY = 'zerosec_user';
  }

  /**
   * Login user with email/username and password
   */
  async login(username, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      this.setToken(data.access_token);
      this.setUser(data.user);

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Auto-login after successful registration
      if (userData.password) {
        await this.login(userData.username, userData.password);
      }

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      const token = this.getToken();
      if (token) {
        // Call logout endpoint
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage
      this.clearAuth();
    }
  }

  /**
   * Get current user info from backend
   */
  async getCurrentUser() {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get user');
      }

      // Update stored user data
      this.setUser(data.user);

      return data.user;
    } catch (error) {
      console.error('Get current user error:', error);
      // If token is invalid, clear auth
      if (error.message.includes('token') || error.message.includes('401')) {
        this.clearAuth();
      }
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const token = this.getToken();
      if (!token) {
        throw new Error('No token found');
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      return data;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Store token in localStorage
   */
  setToken(token) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  /**
   * Get token from localStorage
   */
  getToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /**
   * Store user data in localStorage
   */
  setUser(user) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  /**
   * Get user data from localStorage
   */
  getUser() {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem(this.USER_KEY);
      return user ? JSON.parse(user) : null;
    }
    return null;
  }

  /**
   * Clear all auth data
   */
  clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(permission) {
    const user = this.getUser();
    return user?.permissions?.includes(permission) || false;
  }

  /**
   * Check if user has specific role
   */
  hasRole(role) {
    const user = this.getUser();
    return user?.roles?.includes(role) || false;
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;
