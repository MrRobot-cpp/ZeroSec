import { useState, useEffect, useCallback } from "react";
import { getUsers, createUser as apiCreateUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser } from "@/services/userService";

export default function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUsers();
      setUsers(data);
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
      const newUser = await apiCreateUser(userData);
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
      const updatedUser = await apiUpdateUser(userId, userData);
      setUsers((prev) => prev.map((user) => (user.user_id === userId ? updatedUser : user)));
    } catch (err) {
      setError(err.message || "Failed to update user");
      console.error("Error updating user:", err);
      throw err;
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (userId) => {
    try {
      await apiDeleteUser(userId);
      setUsers((prev) => prev.filter((user) => user.user_id !== userId));
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
