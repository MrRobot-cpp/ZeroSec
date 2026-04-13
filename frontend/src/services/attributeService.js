/**
 * Attribute Service
 *
 * API service layer for attribute management operations (ABAC).
 * Handles departments and clearance levels.
 * Backend API endpoints at /api/attributes
 */

import apiClient from './apiClient';

// ─── Mappers ───

function mapDepartment(d) {
  return {
    id: String(d.department_id),
    name: d.name,
    description: d.description || '',
    color: d.color || '#3b82f6',
    userCount: d.user_count ?? 0,
  };
}

function mapClearanceLevel(c) {
  return {
    id: String(c.clearance_level_id),
    name: c.name,
    description: c.description || '',
    level: c.level,
    color: c.color || '#3b82f6',
    userCount: c.user_count ?? 0,
  };
}

// ========== Department Operations ==========

/**
 * Get all departments
 * @returns {Promise<Array>} Array of department objects
 */
export async function getDepartments() {
  const response = await apiClient.get('/api/attributes/departments');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return (data.departments || []).map(mapDepartment);
}

/**
 * Get department by ID
 * @param {string} departmentId - Department ID
 * @returns {Promise<Object>} Department object
 */
export async function getDepartmentById(departmentId) {
  const response = await apiClient.get(`/api/attributes/departments/${departmentId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapDepartment(data.department);
}

/**
 * Create new department
 * @param {Object} departmentData - { name, description, color }
 * @returns {Promise<Object>} Created department object
 */
export async function createDepartment(departmentData) {
  const response = await apiClient.post('/api/attributes/departments', departmentData);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapDepartment(data.department);
}

/**
 * Update existing department
 * @param {string} departmentId - Department ID
 * @param {Object} departmentData - Updated department data
 * @returns {Promise<Object>} Updated department object
 */
export async function updateDepartment(departmentId, departmentData) {
  const response = await apiClient.put(`/api/attributes/departments/${departmentId}`, departmentData);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapDepartment(data.department);
}

/**
 * Delete department
 * @param {string} departmentId - Department ID
 * @returns {Promise<void>}
 */
export async function deleteDepartment(departmentId) {
  const response = await apiClient.delete(`/api/attributes/departments/${departmentId}`);

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
  const response = await apiClient.get('/api/attributes/clearance-levels');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return (data.clearanceLevels || []).map(mapClearanceLevel);
}

/**
 * Get clearance level by ID
 * @param {string} clearanceId - Clearance level ID
 * @returns {Promise<Object>} Clearance level object
 */
export async function getClearanceLevelById(clearanceId) {
  const response = await apiClient.get(`/api/attributes/clearance-levels/${clearanceId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapClearanceLevel(data.clearanceLevel);
}

/**
 * Create new clearance level
 * @param {Object} clearanceData - { name, description, level, color }
 * @returns {Promise<Object>} Created clearance level object
 */
export async function createClearanceLevel(clearanceData) {
  const response = await apiClient.post('/api/attributes/clearance-levels', clearanceData);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapClearanceLevel(data.clearanceLevel);
}

/**
 * Update existing clearance level
 * @param {string} clearanceId - Clearance level ID
 * @param {Object} clearanceData - Updated clearance level data
 * @returns {Promise<Object>} Updated clearance level object
 */
export async function updateClearanceLevel(clearanceId, clearanceData) {
  const response = await apiClient.put(`/api/attributes/clearance-levels/${clearanceId}`, clearanceData);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapClearanceLevel(data.clearanceLevel);
}

/**
 * Delete clearance level
 * @param {string} clearanceId - Clearance level ID
 * @returns {Promise<void>}
 */
export async function deleteClearanceLevel(clearanceId) {
  const response = await apiClient.delete(`/api/attributes/clearance-levels/${clearanceId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
}
