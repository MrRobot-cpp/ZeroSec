/**
 * User Service
 *
 * API service layer for user management operations.
 * TODO: Implement backend API endpoints at http://localhost:5200/api/users
 *
 * Expected Backend Endpoints:
 * - GET    /api/users              - Get all users
 * - GET    /api/users/:id          - Get user by ID
 * - POST   /api/users              - Create new user
 * - PUT    /api/users/:id          - Update user
 * - DELETE /api/users/:id          - Delete user
 * - POST   /api/users/:id/suspend  - Suspend user account
 * - POST   /api/users/:id/activate - Activate user account
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Get all users
 * @returns {Promise<Array>} Array of user objects
 */
export async function getUsers() {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header when auth is implemented
      // "Authorization": `Bearer ${getAuthToken()}`,
    },
  });

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
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
  });

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
 * @param {string} userData.role - Role ID
 * @param {string} userData.department - Department ID
 * @param {string} userData.clearanceLevel - Clearance level ID
 * @param {string} userData.status - User status (active, inactive, suspended)
 * @returns {Promise<Object>} Created user object
 */
export async function createUser(userData) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(userData),
  });

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
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(userData),
  });

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
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
  });

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
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/suspend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
  });

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
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.user;
}
