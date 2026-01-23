"use client";
import { useRouter, usePathname } from "next/navigation";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", path: "/" },
    { label: "RAG Assistant", path: "/rag" },
    { label: "Documents", path: "/documents" },
   { label: "Canary Watermark", path: "/canary" },
    { label: "Users & Access", path: "/users" },
    { label: "Logs & Alerts", path: "/logs-alerts" },
  ];

  return (
    <aside className="w-64 bg-gray-900 flex flex-col p-4 border-r border-gray-800">
      <h1 className="text-2xl font-bold mb-8">ZeroSec</h1>
      <nav className="space-y-4">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 p-2 rounded-md w-full text-left transition-colors ${
                isActive
                  ? "bg-blue-600"
                  : "hover:bg-gray-800"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}