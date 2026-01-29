"use client";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, user } = useAuth();

  // Navigation items with required permissions
  // The backend uses generic permissions: read, create, update, delete, admin
  // - Admin role has: create, read, update, delete
  // - User role has: read, create
  // - Viewer role has: read
  const navItems = [
    { label: "Dashboard", path: "/dashboard", permission: null }, // All authenticated users
    { label: "RAG Assistant", path: "/rag", permission: "read" }, // Anyone with read access
    { label: "Documents", path: "/documents", permission: "read" }, // Anyone with read access
    { label: "Canary Watermark", path: "/canary", permission: "create" }, // Requires create permission
    { label: "Policies", path: "/policies", permission: "update" }, // Requires update permission (managers+)
    { label: "Users & Access", path: "/users", permission: "admin" }, // Admin only
    { label: "Logs & Alerts", path: "/logs-alerts", permission: "read" }, // Anyone with read access
  ];

  const bottomNavItems = [
    { label: "Settings", path: "/settings", icon: "⚙️", permission: "admin" }, // Admin only
  ];

  // Filter nav items based on user permissions
  const filterByPermission = (items) => {
    return items.filter((item) => {
      // No permission required - show to all authenticated users
      if (item.permission === null) return true;
      // Check if user has the required permission
      return hasPermission(item.permission);
    });
  };

  const visibleNavItems = filterByPermission(navItems);
  const visibleBottomNavItems = filterByPermission(bottomNavItems);

  return (
    <aside className="w-64 bg-gray-900 flex flex-col p-4 border-r border-gray-800">
      <h1 className="text-2xl font-bold mb-8">ZeroSec</h1>

      {/* Main Navigation */}
      <nav className="space-y-2 flex-1">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 p-3 rounded-md w-full text-left transition-colors ${isActive
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-800 text-gray-300"
                }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom Navigation (Settings, etc.) */}
      {visibleBottomNavItems.length > 0 && (
        <div className="mt-auto pt-4 border-t border-gray-800">
          <nav className="space-y-2">
            {visibleBottomNavItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`flex items-center gap-3 p-3 rounded-md w-full text-left transition-colors ${isActive
                      ? "bg-blue-600 text-white"
                      : "hover:bg-gray-800 text-gray-300"
                    }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}