/**
 * User Service
 *
 * API service layer for user management operations.
 */

import apiClient from './apiClient';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Get all users
 * @returns {Promise<Array>} Array of user objects
 */
export async function getUsers() {
  const response = await apiClient.get('/api/users');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.users || [];
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
export async function getUserById(userId) {
  const response = await apiClient.get(`/api/users/${userId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Create new user
 * @param {Object} userData - User data
 * @param {string} userData.username - Username
 * @param {string} userData.email - Email address
 * @param {string} userData.password - Password
 * @param {string} userData.department_id - Department ID
 * @param {string} userData.clearance_level_id - Clearance level ID
 * @param {string} userData.status - User status (active, inactive, suspended)
 * @returns {Promise<Object>} Created user object
 */
export async function createUser(userData) {
  const response = await apiClient.post('/api/users', userData);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Update existing user
 * @param {string} userId - User ID
 * @param {Object} userData - Updated user data
 * @returns {Promise<Object>} Updated user object
 */
export async function updateUser(userId, userData) {
  const response = await apiClient.put(`/api/users/${userId}`, userData);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Delete user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  const response = await apiClient.delete(`/api/users/${userId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
}

/**
 * Suspend user account
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user object
 */
export async function suspendUser(userId) {
  const response = await apiClient.post(`/api/users/${userId}/suspend`, {});

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.user;
}

/**
 * Activate user account
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user object
 */
export async function activateUser(userId) {
  const response = await apiClient.post(`/api/users/${userId}/activate`, {});

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.user;
}
