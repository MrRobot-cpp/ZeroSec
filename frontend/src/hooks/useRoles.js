import { useState, useEffect, useCallback } from "react";
import {
  getRoles,
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
} from "@/services/roleService";

export default function useRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (err) {
      setError(err.message || "Failed to fetch roles");
      console.error("Error fetching roles:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(async (roleData) => {
    try {
      const newRole = await apiCreateRole(roleData);
      setRoles((prev) => [...prev, newRole]);
      return newRole;
    } catch (err) {
      setError(err.message || "Failed to create role");
      console.error("Error creating role:", err);
      throw err;
    }
  }, []);

  const updateRole = useCallback(async (roleId, roleData) => {
    try {
      const updatedRole = await apiUpdateRole(roleId, roleData);
      setRoles((prev) => prev.map((role) => (role.id === roleId ? updatedRole : role)));
    } catch (err) {
      setError(err.message || "Failed to update role");
      console.error("Error updating role:", err);
      throw err;
    }
  }, []);

  const deleteRole = useCallback(async (roleId) => {
    try {
      await apiDeleteRole(roleId);
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
