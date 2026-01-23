import { useState, useEffect, useCallback } from "react";
// TODO: Replace with actual API service when backend is ready
// import { getRoles, createRole as apiCreateRole, updateRole as apiUpdateRole, deleteRole as apiDeleteRole } from "@/services/roleService";

// Placeholder data for development
const PLACEHOLDER_ROLES = [
  {
    id: "1",
    name: "Admin",
    description: "Full system access with all permissions",
    userCount: 1,
    permissions: {
      dashboard: { view: true, edit: true },
      documents: { view: true, edit: true, delete: true, upload: true },
      rag: { view: true, query: true },
      security: { view: true, edit: true },
      analytics: { view: true, export: true },
      users: { view: true, create: true, edit: true, delete: true },
      roles: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, edit: true },
    },
  },
  {
    id: "2",
    name: "Security Analyst",
    description: "Security monitoring and analysis capabilities",
    userCount: 1,
    permissions: {
      dashboard: { view: true, edit: false },
      documents: { view: true, edit: true, delete: false, upload: true },
      rag: { view: true, query: true },
      security: { view: true, edit: true },
      analytics: { view: true, export: true },
      users: { view: true, create: false, edit: false, delete: false },
      roles: { view: true, create: false, edit: false, delete: false },
      settings: { view: true, edit: false },
    },
  },
  {
    id: "3",
    name: "Auditor",
    description: "Read-only access for compliance and auditing",
    userCount: 1,
    permissions: {
      dashboard: { view: true, edit: false },
      documents: { view: true, edit: false, delete: false, upload: false },
      rag: { view: true, query: false },
      security: { view: true, edit: false },
      analytics: { view: true, export: true },
      users: { view: true, create: false, edit: false, delete: false },
      roles: { view: true, create: false, edit: false, delete: false },
      settings: { view: true, edit: false },
    },
  },
  {
    id: "4",
    name: "User",
    description: "Basic user access with limited permissions",
    userCount: 2,
    permissions: {
      dashboard: { view: true, edit: false },
      documents: { view: true, edit: false, delete: false, upload: false },
      rag: { view: true, query: true },
      security: { view: false, edit: false },
      analytics: { view: false, export: false },
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      settings: { view: true, edit: false },
    },
  },
];

export default function useRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call when backend is ready
      // const data = await getRoles();
      // setRoles(data);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setRoles(PLACEHOLDER_ROLES);
    } catch (err) {
      setError(err.message || "Failed to fetch roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new role
  const createRole = useCallback(async (roleData) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const newRole = await apiCreateRole(roleData);
      // setRoles((prev) => [...prev, newRole]);

      // Simulate API call
      const newRole = {
        id: Date.now().toString(),
        ...roleData,
        userCount: 0,
      };
      setRoles((prev) => [...prev, newRole]);
      return newRole;
    } catch (err) {
      setError(err.message || "Failed to create role");
      console.error("Error creating role:", err);
      throw err;
    }
  }, []);

  // Update existing role
  const updateRole = useCallback(async (roleId, roleData) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const updatedRole = await apiUpdateRole(roleId, roleData);
      // setRoles((prev) => prev.map((role) => (role.id === roleId ? updatedRole : role)));

      // Simulate API call
      setRoles((prev) =>
        prev.map((role) =>
          role.id === roleId ? { ...role, ...roleData } : role
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update role");
      console.error("Error updating role:", err);
      throw err;
    }
  }, []);

  // Delete role
  const deleteRole = useCallback(async (roleId) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // await apiDeleteRole(roleId);

      // Simulate API call
      setRoles((prev) => prev.filter((role) => role.id !== roleId));
    } catch (err) {
      setError(err.message || "Failed to delete role");
      console.error("Error deleting role:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    loading,
    error,
    createRole,
    updateRole,
    deleteRole,
    refreshRoles: fetchRoles,
  };
}
