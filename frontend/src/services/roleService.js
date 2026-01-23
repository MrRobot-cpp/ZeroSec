/**
 * Role Service
 *
 * API service layer for role management operations (RBAC).
 * TODO: Implement backend API endpoints at http://localhost:5200/api/roles
 *
 * Expected Backend Endpoints:
 * - GET    /api/roles        - Get all roles
 * - GET    /api/roles/:id    - Get role by ID
 * - POST   /api/roles        - Create new role
 * - PUT    /api/roles/:id    - Update role
 * - DELETE /api/roles/:id    - Delete role
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

/**
 * Get all roles
 * @returns {Promise<Array>} Array of role objects
 */
export async function getRoles() {
  const response = await fetch(`${API_BASE_URL}/api/roles`, {
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
  return data.roles || [];
}

/**
 * Get role by ID
 * @param {string} roleId - Role ID
 * @returns {Promise<Object>} Role object
 */
export async function getRoleById(roleId) {
  const response = await fetch(`${API_BASE_URL}/api/roles/${roleId}`, {
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
  return data.role;
}

/**
 * Create new role
 * @param {Object} roleData - Role data
 * @param {string} roleData.name - Role name
 * @param {string} roleData.description - Role description
 * @param {Object} roleData.permissions - Permissions object
 * @returns {Promise<Object>} Created role object
 */
export async function createRole(roleData) {
  const response = await fetch(`${API_BASE_URL}/api/roles`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(roleData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.role;
}

/**
 * Update existing role
 * @param {string} roleId - Role ID
 * @param {Object} roleData - Updated role data
 * @returns {Promise<Object>} Updated role object
 */
export async function updateRole(roleId, roleData) {
  const response = await fetch(`${API_BASE_URL}/api/roles/${roleId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(roleData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.role;
}

/**
 * Delete role
 * @param {string} roleId - Role ID
 * @returns {Promise<void>}
 */
export async function deleteRole(roleId) {
  const response = await fetch(`${API_BASE_URL}/api/roles/${roleId}`, {
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
