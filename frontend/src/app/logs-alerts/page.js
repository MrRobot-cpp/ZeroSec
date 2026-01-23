"use client";

import Sidebar from "@/components/Sidebar";
import LogsAndAlerts from "@/components/LogsAndAlerts";

export default function LogsAlertsPage() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 p-6">
        <LogsAndAlerts />
      </main>
    </div>
  );
}
