import { useState } from "react";
import PropTypes from "prop-types";
import UsersTab from "./UsersTab";
import RolesTab from "./RolesTab";
import AttributesTab from "./AttributesTab";

export default function UsersAccessControl() {
  const [activeTab, setActiveTab] = useState("users");

  const tabs = [
    { id: "users", label: "Users" },
    { id: "roles", label: "Roles" },
    { id: "attributes", label: "Attributes" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Users & Access Control</h1>
          <p className="text-gray-400 mt-1">
            Manage users, roles, and attribute-based access control
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-1 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "users" && <UsersTab />}
        {activeTab === "roles" && <RolesTab />}
        {activeTab === "attributes" && <AttributesTab />}
      </div>
    </div>
  );
}
