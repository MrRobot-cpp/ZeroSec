import { useState } from "react";
import PropTypes from "prop-types";
import useUsers from "@/hooks/useUsers";

export default function UsersTab() {
  const { users, loading, error, createUser, updateUser, deleteUser } = useUsers();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "",
    department: "",
    clearanceLevel: "",
    status: "Active",
  });

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: "",
        role: user.role,
        department: user.department,
        clearanceLevel: user.clearanceLevel,
        status: user.status,
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: "",
        email: "",
        password: "",
        role: "",
        department: "",
        clearanceLevel: "",
        status: "Active",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const apiData = {
      username: formData.username,
      email: formData.email,
      password: formData.password,
      status: formData.status,
      role: formData.role || null,
      department: formData.department || null,
      clearanceLevel: formData.clearanceLevel || null,
    };

    if (editingUser) {
      await updateUser(editingUser.user_id, apiData);
    } else {
      await createUser(apiData);
    }
    handleCloseModal();
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      await deleteUser(userToDelete.user_id);
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const getStatusBadge = (status) => {
    const statusStyles = {
      active: "bg-green-900/50 text-green-300",
      inactive: "bg-gray-700 text-gray-300",
      suspended: "bg-red-900/50 text-red-300",
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[status] || statusStyles.inactive}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading users...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="text-red-400">Error loading users: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Total Users: <span className="text-white font-semibold">{users.length}</span>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-xl shadow border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead>
              <tr className="text-sm text-gray-400 bg-gray-900/50">
                <th className="py-4 px-6 font-medium">Username</th>
                <th className="py-4 px-6 font-medium">Email</th>
                <th className="py-4 px-6 font-medium">Role</th>
                <th className="py-4 px-6 font-medium">Department</th>
                <th className="py-4 px-6 font-medium">Clearance</th>
                <th className="py-4 px-6 font-medium">Status</th>
                <th className="py-4 px-6 font-medium">Created</th>
                <th className="py-4 px-6 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-5xl">👤</span>
                      <p className="text-gray-400">No users found</p>
                      <button
                        onClick={() => handleOpenModal()}
                        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                      >
                        Add Your First User
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="py-4 px-6 text-gray-100 font-medium">{user.username}</td>
                    <td className="py-4 px-6 text-gray-300">{user.email}</td>
                    <td className="py-4 px-6 text-gray-400 text-sm">{user.role || "N/A"}</td>
                    <td className="py-4 px-6 text-gray-400 text-sm">{user.department || "N/A"}</td>
                    <td className="py-4 px-6 text-gray-400 text-sm">{user.clearanceLevel || "N/A"}</td>
                    <td className="py-4 px-6">{getStatusBadge(user.status)}</td>
                    <td className="py-4 px-6 text-gray-400 text-sm">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(user)}
                          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteClick(user)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-6">
              {editingUser ? "Edit User" : "Create New User"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="user@example.com"
                  />
                </div>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Password *
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                </div>
              )}

              {editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select role</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                    <option value="Security Analyst">Security Analyst</option>
                    <option value="Auditor">Auditor</option>
                    <option value="User">User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Department
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select department</option>
                    <option value="General">General</option>
                    <option value="Security">Security</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Operations">Operations</option>
                    <option value="Compliance">Compliance</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Clearance Level
                  </label>
                  <select
                    value={formData.clearanceLevel}
                    onChange={(e) => setFormData({ ...formData, clearanceLevel: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select clearance level</option>
                    <option value="Public">Public</option>
                    <option value="Internal">Internal</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Secret">Secret</option>
                    <option value="Top Secret">Top Secret</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Status *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  {editingUser ? "Update User" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Delete</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete user <span className="font-semibold text-white">{userToDelete?.username}</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
