import { useState, useEffect, useCallback } from "react";
// TODO: Replace with actual API service when backend is ready
// import { getUsers, createUser as apiCreateUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser } from "@/services/userService";

// Placeholder data for development
const PLACEHOLDER_USERS = [
  {
    id: "1",
    username: "admin",
    email: "admin@zerosec.com",
    role: "Admin",
    department: "Security",
    clearanceLevel: "Top Secret",
    status: "active",
    lastLogin: "2026-01-21 10:30 AM",
  },
  {
    id: "2",
    username: "analyst1",
    email: "analyst@zerosec.com",
    role: "Security Analyst",
    department: "Security",
    clearanceLevel: "Secret",
    status: "active",
    lastLogin: "2026-01-21 09:15 AM",
  },
  {
    id: "3",
    username: "auditor1",
    email: "auditor@zerosec.com",
    role: "Auditor",
    department: "Compliance",
    clearanceLevel: "Confidential",
    status: "active",
    lastLogin: "2026-01-20 04:45 PM",
  },
  {
    id: "4",
    username: "engineer1",
    email: "engineer@zerosec.com",
    role: "User",
    department: "Engineering",
    clearanceLevel: "Internal",
    status: "active",
    lastLogin: "2026-01-21 08:00 AM",
  },
  {
    id: "5",
    username: "tempuser",
    email: "temp@zerosec.com",
    role: "User",
    department: "Operations",
    clearanceLevel: "Internal",
    status: "suspended",
    lastLogin: "2026-01-15 02:30 PM",
  },
];

export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: Replace with actual API call when backend is ready
      // const data = await getUsers();
      // setUsers(data);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setUsers(PLACEHOLDER_USERS);
    } catch (err) {
      setError(err.message || "Failed to fetch users");
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new user
  const createUser = useCallback(async (userData) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const newUser = await apiCreateUser(userData);
      // setUsers((prev) => [...prev, newUser]);

      // Simulate API call
      const newUser = {
        id: Date.now().toString(),
        ...userData,
        lastLogin: "Never",
      };
      setUsers((prev) => [...prev, newUser]);
      return newUser;
    } catch (err) {
      setError(err.message || "Failed to create user");
      console.error("Error creating user:", err);
      throw err;
    }
  }, []);

  // Update existing user
  const updateUser = useCallback(async (userId, userData) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // const updatedUser = await apiUpdateUser(userId, userData);
      // setUsers((prev) => prev.map((user) => (user.id === userId ? updatedUser : user)));

      // Simulate API call
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, ...userData } : user
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update user");
      console.error("Error updating user:", err);
      throw err;
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (userId) => {
    try {
      // TODO: Replace with actual API call when backend is ready
      // await apiDeleteUser(userId);

      // Simulate API call
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      setError(err.message || "Failed to delete user");
      console.error("Error deleting user:", err);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    deleteUser,
    refreshUsers: fetchUsers,
  };
}
