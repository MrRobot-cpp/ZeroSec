import { useState } from "react";
import PropTypes from "prop-types";
import useAttributes from "@/hooks/useAttributes";

export default function AttributesTab() {
  const { departments, clearanceLevels, loading, error, createDepartment, updateDepartment, deleteDepartment, createClearanceLevel, updateClearanceLevel, deleteClearanceLevel } = useAttributes();
  const [activeSection, setActiveSection] = useState("departments");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(""); // "department" or "clearance"
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    level: 1,
    permissions: [],
  });

  const handleOpenModal = (type, item = null) => {
    setModalType(type);
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description,
        color: item.color || "#3b82f6",
        level: item.level || 1,
        permissions: item.permissions || [],
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: "",
        description: "",
        color: "#3b82f6",
        level: type === "clearance" ? 1 : undefined,
        permissions: [],
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setModalType("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modalType === "department") {
      if (editingItem) {
        await updateDepartment(editingItem.id, formData);
      } else {
        await createDepartment(formData);
      }
    } else if (modalType === "clearance") {
      if (editingItem) {
        await updateClearanceLevel(editingItem.id, formData);
      } else {
        await createClearanceLevel(formData);
      }
    }
    handleCloseModal();
  };

  const handleDeleteClick = (type, item) => {
    setModalType(type);
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (itemToDelete) {
      if (modalType === "department") {
        await deleteDepartment(itemToDelete.id);
      } else if (modalType === "clearance") {
        await deleteClearanceLevel(itemToDelete.id);
      }
      setShowDeleteModal(false);
      setItemToDelete(null);
      setModalType("");
    }
  };

  const colorOptions = [
    { value: "#3b82f6", label: "Blue" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#10b981", label: "Green" },
    { value: "#f59e0b", label: "Orange" },
    { value: "#ef4444", label: "Red" },
    { value: "#06b6d4", label: "Cyan" },
    { value: "#ec4899", label: "Pink" },
  ];

  if (loading) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading attributes...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-xl shadow border border-gray-700">
        <div className="flex items-center justify-center py-12">
          <div className="text-red-400">Error loading attributes: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Toggle */}
      <div className="flex items-center justify-between">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-1 inline-flex gap-1">
          <button
            onClick={() => setActiveSection("departments")}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              activeSection === "departments"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Departments
          </button>
          <button
            onClick={() => setActiveSection("clearance")}
            className={`px-4 py-2 rounded-md font-medium transition-all duration-200 ${
              activeSection === "clearance"
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Clearance Levels
          </button>
        </div>
        <button
          onClick={() => handleOpenModal(activeSection === "departments" ? "department" : "clearance")}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium flex items-center gap-2"
        >
          <span>+</span>
          {activeSection === "departments" ? "Add Department" : "Add Clearance Level"}
        </button>
      </div>

      {/* Departments Section */}
      {activeSection === "departments" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.length === 0 ? (
            <div className="col-span-full bg-gray-800 rounded-xl shadow border border-gray-700 p-12">
              <div className="flex flex-col items-center gap-3">
                <span className="text-5xl">🏢</span>
                <p className="text-gray-400">No departments found</p>
                <button
                  onClick={() => handleOpenModal("department")}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                >
                  Create Your First Department
                </button>
              </div>
            </div>
          ) : (
            departments.map((dept) => (
              <div
                key={dept.id}
                className="bg-gray-800 rounded-xl shadow border border-gray-700 p-6 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                      style={{ backgroundColor: dept.color + "30" }}
                    >
                      🏢
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{dept.name}</h3>
                      <span className="text-xs text-gray-400">{dept.userCount || 0} users</span>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4 min-h-[40px]">{dept.description}</p>

                <div className="flex gap-2 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => handleOpenModal("department", dept)}
                    className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteClick("department", dept)}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Clearance Levels Section */}
      {activeSection === "clearance" && (
        <div className="space-y-3">
          {clearanceLevels.length === 0 ? (
            <div className="bg-gray-800 rounded-xl shadow border border-gray-700 p-12">
              <div className="flex flex-col items-center gap-3">
                <span className="text-5xl">🔒</span>
                <p className="text-gray-400">No clearance levels found</p>
                <button
                  onClick={() => handleOpenModal("clearance")}
                  className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm"
                >
                  Create Your First Clearance Level
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl shadow border border-gray-700 overflow-hidden">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="text-sm text-gray-400 bg-gray-900/50">
                    <th className="py-4 px-6 font-medium">Level</th>
                    <th className="py-4 px-6 font-medium">Name</th>
                    <th className="py-4 px-6 font-medium">Description</th>
                    <th className="py-4 px-6 font-medium">Users</th>
                    <th className="py-4 px-6 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clearanceLevels
                    .sort((a, b) => b.level - a.level)
                    .map((clearance) => (
                      <tr
                        key={clearance.id}
                        className="border-t border-gray-700 hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="py-4 px-6">
                          <span
                            className="px-3 py-1 rounded font-bold text-sm"
                            style={{
                              backgroundColor: clearance.color + "30",
                              color: clearance.color,
                            }}
                          >
                            L{clearance.level}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-white font-medium">{clearance.name}</td>
                        <td className="py-4 px-6 text-gray-400">{clearance.description}</td>
                        <td className="py-4 px-6 text-gray-300">
                          {clearance.userCount || 0} users
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleOpenModal("clearance", clearance)}
                              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClick("clearance", clearance)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-white mb-6">
              {editingItem
                ? `Edit ${modalType === "department" ? "Department" : "Clearance Level"}`
                : `Create New ${modalType === "department" ? "Department" : "Clearance Level"}`}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={modalType === "department" ? "e.g., Security" : "e.g., Top Secret"}
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
                  placeholder={
                    modalType === "department"
                      ? "Describe the department's purpose and responsibilities"
                      : "Describe the clearance level and access rights"
                  }
                  rows="3"
                />
              </div>

              {modalType === "clearance" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Security Level *
                  </label>
                  <select
                    required
                    value={formData.level}
                    onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Level 1 (Lowest)</option>
                    <option value={2}>Level 2</option>
                    <option value={3}>Level 3</option>
                    <option value={4}>Level 4</option>
                    <option value={5}>Level 5 (Highest)</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Higher levels grant access to lower level resources
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Color *</label>
                <div className="grid grid-cols-7 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-full aspect-square rounded-lg transition-all ${
                        formData.color === color.value
                          ? "ring-2 ring-white ring-offset-2 ring-offset-gray-800 scale-110"
                          : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    />
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
                  {editingItem ? "Update" : "Create"}
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
              Are you sure you want to delete{" "}
              {modalType === "department" ? "department" : "clearance level"}{" "}
              <span className="font-semibold text-white">{itemToDelete?.name}</span>?{" "}
              {modalType === "department"
                ? "Users in this department will need to be reassigned."
                : "Users with this clearance level will need to be updated."}
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
