import { useState } from "react";
import PropTypes from "prop-types";
import useRoles from "@/hooks/useRoles";

export default function RolesTab() {
  const { roles, loading, error, createRole, updateRole, deleteRole } = useRoles();
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    permissions: {
      dashboard: { view: false, edit: false },
      documents: { view: false, edit: false, delete: false, upload: false },
      rag: { view: false, query: false },
      security: { view: false, edit: false },
      analytics: { view: false, export: false },
      users: { view: false, create: false, edit: false, delete: false },
      roles: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, edit: false },
    },
  });

  const permissionCategories = [
    {
      name: "dashboard",
      label: "Dashboard",
      permissions: ["view", "edit"],
    },
    {
      name: "documents",
      label: "Documents",
      permissions: ["view", "edit", "delete", "upload"],
    },
    {
      name: "rag",
      label: "RAG Assistant",
      permissions: ["view", "query"],
    },
    {
      name: "security",
      label: "Data Security",
      permissions: ["view", "edit"],
    },
    {
      name: "analytics",
      label: "Analytics",
      permissions: ["view", "export"],
    },
    {
      name: "users",
      label: "Users",
      permissions: ["view", "create", "edit", "delete"],
    },
    {
      name: "roles",
      label: "Roles",
      permissions: ["view", "create", "edit", "delete"],
    },
    {
      name: "settings",
      label: "Settings",
      permissions: ["view", "edit"],
    },
  ];

  const handleOpenModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      });
    } else {
      setEditingRole(null);
      setFormData({
        name: "",
        description: "",
        permissions: {
          dashboard: { view: false, edit: false },
          documents: { view: false, edit: false, delete: false, upload: false },
          rag: { view: false, query: false },
          security: { view: false, edit: false },
          analytics: { view: false, export: false },
          users: { view: false, create: false, edit: false, delete: false },
          roles: { view: false, create: false, edit: false, delete: false },
          settings: { view: false, edit: false },
        },
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRole(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingRole) {
      await updateRole(editingRole.id, formData);
    } else {
      await createRole(formData);
    }
    handleCloseModal();
  };

  const handleDeleteClick = (role) => {
    setRoleToDelete(role);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (roleToDelete) {
      await deleteRole(roleToDelete.id);
      setShowDeleteModal(false);
      setRoleToDelete(null);
    }
  };

  const handlePermissionChange = (category, permission, value) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [category]: {
          ...formData.permissions[category],
          [permission]: value,
        },
      },
    });
  };

  const countPermissions = (permissions) => {
    let count = 0;
    Object.values(permissions).forEach((category) => {
      Object.values(category).forEach((value) => {
        if (value) count++;
      });
    });
    return count;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading roles...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="text-red-400">Error loading roles: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Total Roles: <span className="text-white font-semibold">{roles.length}</span>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          Add Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.length === 0 ? (
          <div className="col-span-full bg-gray-800 rounded-xl shadow border border-gray-700 p-12">
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl">🔑</span>
              <p className="text-gray-400">No roles found</p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
              >
                Create Your First Role
              </button>
            </div>
          </div>
        ) : (
          roles.map((role) => (
            <div
              key={role.id}
              className="bg-gray-800 rounded-xl shadow border border-gray-700 p-6 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{role.name}</h3>
                  <p className="text-sm text-gray-400">{role.description}</p>
                </div>
                <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs font-medium">
                  {role.userCount || 0} users
                </span>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                  <span>Permissions:</span>
                  <span className="text-white font-semibold">
                    {countPermissions(role.permissions)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(role.permissions).map(([category, perms]) => {
                    const activePerms = Object.entries(perms).filter(([_, val]) => val);
                    if (activePerms.length === 0) return null;
                    return (
                      <span
                        key={category}
                        className="px-2 py-1 bg-purple-900/30 text-purple-300 rounded text-xs"
                      >
                        {category}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-700">
                <button
                  onClick={() => handleOpenModal(role)}
                  className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteClick(role)}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Role Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-6">
              {editingRole ? "Edit Role" : "Create New Role"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Security Analyst"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the role and its responsibilities"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-4">
                  Permissions *
                </label>
                <div className="space-y-4">
                  {permissionCategories.map((category) => (
                    <div
                      key={category.name}
                      className="bg-gray-900 rounded-lg p-4 border border-gray-700"
                    >
                      <h4 className="text-white font-semibold mb-3">{category.label}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {category.permissions.map((permission) => (
                          <label
                            key={permission}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.permissions[category.name]?.[permission] || false}
                              onChange={(e) =>
                                handlePermissionChange(
                                  category.name,
                                  permission,
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                            />
                            <span className="text-sm text-gray-300 capitalize">{permission}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
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
                  {editingRole ? "Update Role" : "Create Role"}
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
              Are you sure you want to delete role{" "}
              <span className="font-semibold text-white">{roleToDelete?.name}</span>? Users with
              this role will need to be reassigned.
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
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
