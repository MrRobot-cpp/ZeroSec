import { useState, useEffect, useCallback } from "react";
// TODO: Replace with actual API service when backend is ready
// import { getDepartments, getClearanceLevels, createDepartment as apiCreateDepartment, updateDepartment as apiUpdateDepartment, deleteDepartment as apiDeleteDepartment, createClearanceLevel as apiCreateClearanceLevel, updateClearanceLevel as apiUpdateClearanceLevel, deleteClearanceLevel as apiDeleteClearanceLevel } from "@/services/attributeService";

// Placeholder data for development
const PLACEHOLDER_DEPARTMENTS = [
  {
    id: "1",
    name: "Security",
    description: "Responsible for threat detection, incident response, and security operations",
    color: "#ef4444",
    userCount: 2,
  },
  {
    id: "2",
    name: "Engineering",
    description: "Software development, infrastructure, and technical operations",
    color: "#3b82f6",
    userCount: 1,
  },
  {
    id: "3",
    name: "Operations",
    description: "Daily operations, monitoring, and system maintenance",
    color: "#10b981",
    userCount: 1,
  },
  {
    id: "4",
    name: "Compliance",
    description: "Regulatory compliance, auditing, and policy enforcement",
    color: "#8b5cf6",
    userCount: 1,
  },
];

const PLACEHOLDER_CLEARANCE_LEVELS = [
  {
    id: "1",
    name: "Public",
    description: "Information that can be freely shared with anyone",
    level: 1,
    color: "#10b981",
    userCount: 0,
  },
  {
    id: "2",
    name: "Internal",
    description: "Information for internal use only within the organization",
    level: 2,
    color: "#3b82f6",
    userCount: 2,
  },
  {
    id: "3",
    name: "Confidential",
    description: "Sensitive information requiring authorized access",
    level: 3,
    color: "#f59e0b",
    userCount: 1,
  },
  {
    id: "4",
    name: "Secret",
    description: "Highly sensitive information with restricted access",
    level: 4,
    color: "#ec4899",
    userCount: 1,
  },
  {
    id: "5",
    name: "Top Secret",
    description: "Most sensitive information requiring highest level authorization",
    level: 5,
    color: "#ef4444",
    userCount: 1,
  },
];

export default function useAttributes() {
  const [departments, setDepartments] = useState([]);
  const [clearanceLevels, setClearanceLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all attributes
  const fetchAttributes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API calls when backend is ready
      // const [deptData, clearanceData] = await Promise.all([
      //   getDepartments(),
      //   getClearanceLevels(),
      // ]);
      // setDepartments(deptData);
      // setClearanceLevels(clearanceData);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setDepartments(PLACEHOLDER_DEPARTMENTS);
      setClearanceLevels(PLACEHOLDER_CLEARANCE_LEVELS);
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
      // TODO: Replace with actual API call when backend is ready
      // const newDept = await apiCreateDepartment(deptData);
      // setDepartments((prev) => [...prev, newDept]);

      const newDept = {
        id: Date.now().toString(),
        ...deptData,
        userCount: 0,
      };
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
      // TODO: Replace with actual API call when backend is ready
      // const updatedDept = await apiUpdateDepartment(deptId, deptData);
      // setDepartments((prev) => prev.map((dept) => (dept.id === deptId ? updatedDept : dept)));

      setDepartments((prev) =>
        prev.map((dept) =>
          dept.id === deptId ? { ...dept, ...deptData } : dept
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update department");
      console.error("Error updating department:", err);
      throw err;
    }
  }, []);

  const deleteDepartment = useCallback(async (deptId) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // await apiDeleteDepartment(deptId);

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
      // TODO: Replace with actual API call when backend is ready
      // const newClearance = await apiCreateClearanceLevel(clearanceData);
      // setClearanceLevels((prev) => [...prev, newClearance]);

      const newClearance = {
        id: Date.now().toString(),
        ...clearanceData,
        userCount: 0,
      };
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
      // TODO: Replace with actual API call when backend is ready
      // const updatedClearance = await apiUpdateClearanceLevel(clearanceId, clearanceData);
      // setClearanceLevels((prev) => prev.map((cl) => (cl.id === clearanceId ? updatedClearance : cl)));

      setClearanceLevels((prev) =>
        prev.map((cl) =>
          cl.id === clearanceId ? { ...cl, ...clearanceData } : cl
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update clearance level");
      console.error("Error updating clearance level:", err);
      throw err;
    }
  }, []);

  const deleteClearanceLevel = useCallback(async (clearanceId) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // await apiDeleteClearanceLevel(clearanceId);

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
