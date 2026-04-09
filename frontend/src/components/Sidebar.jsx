"use client";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasPermission, user, logout } = useAuth();

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
    <aside className="fixed top-0 left-0 w-64 h-screen bg-gray-900 flex flex-col p-4 border-r border-gray-800 z-30">
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

      {/* Bottom Navigation (Settings, Logout) */}
      <div className="mt-auto pt-4 border-t border-gray-800">
        <nav className="space-y-2">
          {/* Settings Button — animated expand on hover */}
          {visibleBottomNavItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`group relative flex items-center justify-start w-[45px] h-[45px] border-none rounded-full cursor-pointer overflow-hidden transition-all duration-300 shadow-md hover:w-[125px] hover:rounded-[40px] active:translate-x-[2px] active:translate-y-[2px] ${isActive ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}
              >
                <span className="flex items-center justify-center w-full transition-all duration-300 group-hover:w-[30%] group-hover:pl-5">
                  <svg viewBox="0 0 512 512" className="w-[17px] h-[17px] fill-white">
                    <path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z" />
                  </svg>
                </span>
                <span className="absolute right-0 w-0 opacity-0 text-white text-[1.2em] font-semibold transition-all duration-300 group-hover:opacity-100 group-hover:w-[70%] group-hover:pr-[10px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Logout Button — animated expand on hover */}
          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="group relative flex items-center justify-start w-[45px] h-[45px] border-none rounded-full cursor-pointer overflow-hidden transition-all duration-300 shadow-md bg-red-500 hover:w-[125px] hover:rounded-[40px] active:translate-x-[2px] active:translate-y-[2px] mt-2"
          >
            <span className="flex items-center justify-center w-full transition-all duration-300 group-hover:w-[30%] group-hover:pl-5">
              <svg viewBox="0 0 512 512" className="w-[17px] h-[17px] fill-white">
                <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
              </svg>
            </span>
            <span className="absolute right-0 w-0 opacity-0 text-white text-[1.2em] font-semibold transition-all duration-300 group-hover:opacity-100 group-hover:w-[70%] group-hover:pr-[10px]">
              Logout
            </span>
          </button>
        </nav>
      </div>
    </aside>
  );
}