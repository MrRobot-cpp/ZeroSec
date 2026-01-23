"use client";
import { useRouter, usePathname } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "RAG Assistant", path: "/rag" },
    { label: "Documents", path: "/documents" },
    { label: "Canary Watermark", path: "/canary" },
    { label: "Policies", path:"/policies"},
    { label: "Users & Access", path: "/users"  },
    { label: "Logs & Alerts", path: "/logs-alerts" },
  ];

  const bottomNavItems = [
    { label: "Settings", path: "/settings", icon: "⚙️" },
  ];

  return (
    <aside className="w-64 bg-gray-900 flex flex-col p-4 border-r border-gray-800">
      <h1 className="text-2xl font-bold mb-8">ZeroSec</h1>

      {/* Main Navigation */}
      <nav className="space-y-2 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 p-3 rounded-md w-full text-left transition-colors ${
                isActive
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
      <div className="mt-auto pt-4 border-t border-gray-800">
        <nav className="space-y-2">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex items-center gap-3 p-3 rounded-md w-full text-left transition-colors ${
                  isActive
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
    </aside>
  );
}