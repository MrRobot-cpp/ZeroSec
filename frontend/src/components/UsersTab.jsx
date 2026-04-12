import { useState, useEffect } from "react";
import useUsers from "@/hooks/useUsers";
import { getClearanceLevels, getDepartments } from "@/services/attributeService";
import { getRoles } from "@/services/roleService";

const EMPTY_FORM = {
  username: "",
  email: "",
  password: "",
  role: "",
  department: "",
  clearanceLevel: "",
  status: "Active",
};

export default function UsersTab() {
  const { users, loading, error, createUser, updateUser, deleteUser } = useUsers();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  // Dynamic options fetched from the API
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [clearanceLevels, setClearanceLevels] = useState([]);

  useEffect(() => {
    getRoles().then(r => setRoles(r)).catch(() => setRoles([]));
    getDepartments().then(d => setDepartments(d)).catch(() => setDepartments([]));
    getClearanceLevels().then(c => setClearanceLevels(c)).catch(() => setClearanceLevels([]));
  }, []);

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email,
        password: "",
        role: user.role || "",
        department: user.department || "",
        clearanceLevel: user.clearanceLevel || "",
        status: user.status,
      });
    } else {
      setEditingUser(null);
      setFormData(EMPTY_FORM);
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
    const key = status?.toLowerCase();
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyles[key] || statusStyles.inactive}`}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : "—"}
      </span>
    );
  };

  // Clearance levels sorted ascending by level number
  const sortedClearanceLevels = [...clearanceLevels].sort((a, b) => a.level - b.level);

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
          {"+ Add User"}
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
                    <td className="py-4 px-6 text-gray-400 text-sm">{user.role || "—"}</td>
                    <td className="py-4 px-6 text-gray-400 text-sm">{user.department || "—"}</td>
                    <td className="py-4 px-6 text-sm">
                      {user.clearanceLevel
                        ? <span className="px-2 py-1 bg-blue-900/40 text-blue-300 border border-blue-700/50 rounded text-xs font-medium">{user.clearanceLevel}</span>
                        : <span className="text-gray-500">—</span>
                      }
                    </td>
                    <td className="py-4 px-6">{getStatusBadge(user.status)}</td>
                    <td className="py-4 px-6 text-gray-400 text-sm">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
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
                  <label htmlFor="user-username" className="block text-sm font-medium text-gray-300 mb-2">Username *</label>
                  <input
                    id="user-username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                  />
                </div>
                <div>
                  <label htmlFor="user-email" className="block text-sm font-medium text-gray-300 mb-2">Email *</label>
                  <input
                    id="user-email"
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
                  <label htmlFor="user-password" className="block text-sm font-medium text-gray-300 mb-2">Password *</label>
                  <input
                    id="user-password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                </div>
              )}

              {editingUser && (
                <div>
                  <label htmlFor="user-password" className="block text-sm font-medium text-gray-300 mb-2">
                    New Password <span className="text-gray-500">(leave blank to keep current)</span>
                  </label>
                  <input
                    id="user-password"
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
                  <label htmlFor="user-role" className="block text-sm font-medium text-gray-300 mb-2">Role</label>
                  <select
                    id="user-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select role</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="user-department" className="block text-sm font-medium text-gray-300 mb-2">Department</label>
                  <select
                    id="user-department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="user-clearance" className="block text-sm font-medium text-gray-300 mb-2">Clearance Level</label>
                  <select
                    id="user-clearance"
                    value={formData.clearanceLevel}
                    onChange={(e) => setFormData({ ...formData, clearanceLevel: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No restriction</option>
                    {sortedClearanceLevels.map((cl) => (
                      <option key={cl.id} value={cl.name}>{cl.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="user-status" className="block text-sm font-medium text-gray-300 mb-2">Status *</label>
                  <select
                    id="user-status"
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
              Are you sure you want to delete user{" "}
              <span className="font-semibold text-white">{userToDelete?.username}</span>?
              {" "}This action cannot be undone.
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

