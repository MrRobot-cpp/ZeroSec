/**
 * Attribute Service
 *
 * API service layer for attribute management operations (ABAC).
 * Handles departments and clearance levels.
 * TODO: Implement backend API endpoints at http://localhost:5200/api/attributes
 *
 * Expected Backend Endpoints:
 * Departments:
 * - GET    /api/attributes/departments        - Get all departments
 * - GET    /api/attributes/departments/:id    - Get department by ID
 * - POST   /api/attributes/departments        - Create new department
 * - PUT    /api/attributes/departments/:id    - Update department
 * - DELETE /api/attributes/departments/:id    - Delete department
 *
 * Clearance Levels:
 * - GET    /api/attributes/clearance-levels        - Get all clearance levels
 * - GET    /api/attributes/clearance-levels/:id    - Get clearance level by ID
 * - POST   /api/attributes/clearance-levels        - Create new clearance level
 * - PUT    /api/attributes/clearance-levels/:id    - Update clearance level
 * - DELETE /api/attributes/clearance-levels/:id    - Delete clearance level
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5200";

// ========== Department Operations ==========

/**
 * Get all departments
 * @returns {Promise<Array>} Array of department objects
 */
export async function getDepartments() {
  const response = await fetch(`${API_BASE_URL}/api/attributes/departments`, {
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
  return data.departments || [];
}

/**
 * Get department by ID
 * @param {string} departmentId - Department ID
 * @returns {Promise<Object>} Department object
 */
export async function getDepartmentById(departmentId) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/departments/${departmentId}`, {
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
  return data.department;
}

/**
 * Create new department
 * @param {Object} departmentData - Department data
 * @param {string} departmentData.name - Department name
 * @param {string} departmentData.description - Department description
 * @param {string} departmentData.color - Department color (hex)
 * @returns {Promise<Object>} Created department object
 */
export async function createDepartment(departmentData) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/departments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(departmentData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.department;
}

/**
 * Update existing department
 * @param {string} departmentId - Department ID
 * @param {Object} departmentData - Updated department data
 * @returns {Promise<Object>} Updated department object
 */
export async function updateDepartment(departmentId, departmentData) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/departments/${departmentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(departmentData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.department;
}

/**
 * Delete department
 * @param {string} departmentId - Department ID
 * @returns {Promise<void>}
 */
export async function deleteDepartment(departmentId) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/departments/${departmentId}`, {
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

// ========== Clearance Level Operations ==========

/**
 * Get all clearance levels
 * @returns {Promise<Array>} Array of clearance level objects
 */
export async function getClearanceLevels() {
  const response = await fetch(`${API_BASE_URL}/api/attributes/clearance-levels`, {
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
  return data.clearanceLevels || [];
}

/**
 * Get clearance level by ID
 * @param {string} clearanceId - Clearance level ID
 * @returns {Promise<Object>} Clearance level object
 */
export async function getClearanceLevelById(clearanceId) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/clearance-levels/${clearanceId}`, {
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
  return data.clearanceLevel;
}

/**
 * Create new clearance level
 * @param {Object} clearanceData - Clearance level data
 * @param {string} clearanceData.name - Clearance level name
 * @param {string} clearanceData.description - Clearance level description
 * @param {number} clearanceData.level - Security level (1-5, higher = more access)
 * @param {string} clearanceData.color - Clearance level color (hex)
 * @returns {Promise<Object>} Created clearance level object
 */
export async function createClearanceLevel(clearanceData) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/clearance-levels`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(clearanceData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.clearanceLevel;
}

/**
 * Update existing clearance level
 * @param {string} clearanceId - Clearance level ID
 * @param {Object} clearanceData - Updated clearance level data
 * @returns {Promise<Object>} Updated clearance level object
 */
export async function updateClearanceLevel(clearanceId, clearanceData) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/clearance-levels/${clearanceId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      // TODO: Add authentication header
    },
    body: JSON.stringify(clearanceData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.clearanceLevel;
}

/**
 * Delete clearance level
 * @param {string} clearanceId - Clearance level ID
 * @returns {Promise<void>}
 */
export async function deleteClearanceLevel(clearanceId) {
  const response = await fetch(`${API_BASE_URL}/api/attributes/clearance-levels/${clearanceId}`, {
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
