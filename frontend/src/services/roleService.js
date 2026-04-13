/**
 * Role Service
 *
 * API service layer for role management operations (RBAC).
 * Backend API endpoints at /api/roles
 */

import apiClient from './apiClient';

// ─── Permission mapping between backend flat array and frontend nested matrix ───

// Maps each flat backend permission to the nested UI fields it should enable
const FLAT_TO_NESTED_MAP = {
  read:            [['dashboard','view'],['documents','view'],['rag','view'],['security','view'],['analytics','view'],['users','view'],['roles','view'],['settings','view']],
  create:          [['documents','upload'],['users','create'],['roles','create']],
  update:          [['dashboard','edit'],['documents','edit'],['security','edit'],['analytics','export'],['users','edit'],['roles','edit'],['settings','edit']],
  delete:          [['documents','delete'],['users','delete'],['roles','delete']],
  document_view:   [['documents','view'],['rag','view']],
  document_upload: [['documents','upload']],
  document_delete: [['documents','delete']],
  document_manage: [['documents','view'],['documents','edit'],['documents','delete'],['documents','upload']],
  user_manage:     [['users','view'],['users','create'],['users','edit'],['users','delete']],
  role_manage:     [['roles','view'],['roles','create'],['roles','edit'],['roles','delete']],
  policy_manage:   [['security','view'],['security','edit']],
  audit_view:      [['security','view'],['analytics','view']],
  rag_query:       [['rag','query'],['rag','view']],
};

/**
 * Convert backend flat permissions array → frontend nested permissions object
 * e.g. ['read', 'role_manage'] → { dashboard: { view: true }, roles: { view: true, ... }, ... }
 */
function flatToNested(flatPerms = []) {
  const nested = {
    dashboard: { view: false, edit: false },
    documents: { view: false, edit: false, delete: false, upload: false },
    rag: { view: false, query: false },
    security: { view: false, edit: false },
    analytics: { view: false, export: false },
    users: { view: false, create: false, edit: false, delete: false },
    roles: { view: false, create: false, edit: false, delete: false },
    settings: { view: false, edit: false },
  };

  if (flatPerms.includes('admin') || flatPerms.includes('admin_full')) {
    Object.keys(nested).forEach(cat =>
      Object.keys(nested[cat]).forEach(action => { nested[cat][action] = true; })
    );
    return nested;
  }

  flatPerms.forEach(perm => {
    (FLAT_TO_NESTED_MAP[perm] || []).forEach(([cat, action]) => {
      nested[cat][action] = true;
    });
  });

  return nested;
}

/**
 * Convert frontend nested permissions object → backend flat permissions array
 */
function nestedToFlat(nested = {}) {
  const flat = new Set();

  const hasAnyView = Object.values(nested).some(cat => cat?.view);
  if (hasAnyView) flat.add('read');

  if (nested.documents?.view) flat.add('document_view');
  if (nested.documents?.upload) { flat.add('document_upload'); flat.add('create'); }
  if (nested.documents?.edit) flat.add('update');
  if (nested.documents?.delete) { flat.add('document_delete'); flat.add('delete'); }
  if (nested.documents?.view && nested.documents?.edit && nested.documents?.delete && nested.documents?.upload) {
    flat.add('document_manage');
  }

  if (nested.rag?.query) flat.add('rag_query');

  if (nested.security?.view && nested.security?.edit) flat.add('policy_manage');
  if (nested.security?.view) flat.add('audit_view');

  if (nested.users?.view && nested.users?.create && nested.users?.edit && nested.users?.delete) {
    flat.add('user_manage');
  }
  if (nested.roles?.view && nested.roles?.create && nested.roles?.edit && nested.roles?.delete) {
    flat.add('role_manage');
  }

  if (nested.settings?.edit) flat.add('update');
  if (nested.analytics?.export) flat.add('update');

  return Array.from(flat);
}

// ─── Map raw backend role to frontend shape ───
function mapRole(r) {
  return {
    ...r,
    id: String(r.role_id),
    userCount: r.user_count ?? 0,
    permissions: flatToNested(r.permissions || []),
  };
}

// ─── API functions ───

/**
 * Get all roles
 * @returns {Promise<Array>} Array of role objects
 */
export async function getRoles() {
  const response = await apiClient.get('/api/roles');

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return (data.roles || []).map(mapRole);
}

/**
 * Get role by ID
 * @param {string} roleId - Role ID
 * @returns {Promise<Object>} Role object
 */
export async function getRoleById(roleId) {
  const response = await apiClient.get(`/api/roles/${roleId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapRole(data.role || data);
}

/**
 * Create new role
 * @param {Object} roleData - Role data with nested permissions
 * @returns {Promise<Object>} Created role object
 */
export async function createRole(roleData) {
  const payload = {
    name: roleData.name,
    description: roleData.description,
    permissions: Array.isArray(roleData.permissions)
      ? roleData.permissions
      : nestedToFlat(roleData.permissions),
  };

  const response = await apiClient.post('/api/roles', payload);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapRole(data.role);
}

/**
 * Update existing role
 * @param {string} roleId - Role ID
 * @param {Object} roleData - Updated role data
 * @returns {Promise<Object>} Updated role object
 */
export async function updateRole(roleId, roleData) {
  const payload = {
    name: roleData.name,
    description: roleData.description,
    permissions: Array.isArray(roleData.permissions)
      ? roleData.permissions
      : nestedToFlat(roleData.permissions),
  };

  const response = await apiClient.put(`/api/roles/${roleId}`, payload);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return mapRole(data.role);
}

/**
 * Delete role
 * @param {string} roleId - Role ID
 * @returns {Promise<void>}
 */
export async function deleteRole(roleId) {
  const response = await apiClient.delete(`/api/roles/${roleId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
}
