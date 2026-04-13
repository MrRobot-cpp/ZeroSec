"use client";
import Sidebar from "@/components/Sidebar";
import LogsAndAlerts from "@/components/LogsAndAlerts";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function LogsAlertsPage() {
  return (
    <ProtectedRoute requiredPermission="audit_view">
      <div className="flex min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <main className="ml-56 flex-1 p-6">
          <LogsAndAlerts />
        </main>
      </div>
    </ProtectedRoute>
  );
}
