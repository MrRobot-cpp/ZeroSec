import { useState, useEffect, useCallback } from "react";
import {
  getDepartments, getClearanceLevels,
  createDepartment as apiCreateDepartment,
  updateDepartment as apiUpdateDepartment,
  deleteDepartment as apiDeleteDepartment,
  createClearanceLevel as apiCreateClearanceLevel,
  updateClearanceLevel as apiUpdateClearanceLevel,
  deleteClearanceLevel as apiDeleteClearanceLevel,
} from "@/services/attributeService";

export default function useAttributes() {
  const [departments, setDepartments] = useState([]);
  const [clearanceLevels, setClearanceLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttributes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptData, clearanceData] = await Promise.all([
        getDepartments(),
        getClearanceLevels(),
      ]);
      setDepartments(deptData);
      setClearanceLevels(clearanceData);
    } catch (err) {
      setError(err.message || "Failed to fetch attributes");
      console.error("Error fetching attributes:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Department operations
  const createDepartment = useCallback(async (deptData) => {
    try {
      const newDept = await apiCreateDepartment(deptData);
      setDepartments((prev) => [...prev, newDept]);
      return newDept;
    } catch (err) {
      setError(err.message || "Failed to create department");
      console.error("Error creating department:", err);
      throw err;
    }
  }, []);

  const updateDepartment = useCallback(async (deptId, deptData) => {
    try {
      const updatedDept = await apiUpdateDepartment(deptId, deptData);
      setDepartments((prev) => prev.map((dept) => (dept.id === deptId ? updatedDept : dept)));
    } catch (err) {
      setError(err.message || "Failed to update department");
      console.error("Error updating department:", err);
      throw err;
    }
  }, []);

  const deleteDepartment = useCallback(async (deptId) => {
    try {
      await apiDeleteDepartment(deptId);
      setDepartments((prev) => prev.filter((dept) => dept.id !== deptId));
    } catch (err) {
      setError(err.message || "Failed to delete department");
      console.error("Error deleting department:", err);
      throw err;
    }
  }, []);

  // Clearance Level operations
  const createClearanceLevel = useCallback(async (clearanceData) => {
    try {
      const newClearance = await apiCreateClearanceLevel(clearanceData);
      setClearanceLevels((prev) => [...prev, newClearance]);
      return newClearance;
    } catch (err) {
      setError(err.message || "Failed to create clearance level");
      console.error("Error creating clearance level:", err);
      throw err;
    }
  }, []);

  const updateClearanceLevel = useCallback(async (clearanceId, clearanceData) => {
    try {
      const updatedClearance = await apiUpdateClearanceLevel(clearanceId, clearanceData);
      setClearanceLevels((prev) =>
        prev.map((cl) => (cl.id === clearanceId ? updatedClearance : cl))
      );
    } catch (err) {
      setError(err.message || "Failed to update clearance level");
      console.error("Error updating clearance level:", err);
      throw err;
    }
  }, []);

  const deleteClearanceLevel = useCallback(async (clearanceId) => {
    try {
      await apiDeleteClearanceLevel(clearanceId);
      setClearanceLevels((prev) => prev.filter((cl) => cl.id !== clearanceId));
    } catch (err) {
      setError(err.message || "Failed to delete clearance level");
      console.error("Error deleting clearance level:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchAttributes();
  }, [fetchAttributes]);

  return {
    departments,
    clearanceLevels,
    loading,
    error,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    createClearanceLevel,
    updateClearanceLevel,
    deleteClearanceLevel,
    refreshAttributes: fetchAttributes,
  };
}
