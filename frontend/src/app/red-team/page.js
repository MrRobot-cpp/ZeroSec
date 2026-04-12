"use client";
import Sidebar from "@/components/Sidebar";
import RedTeam from "@/components/RedTeam";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function RedTeamPage() {
  return (
    <ProtectedRoute requiredPermission="admin">
      <div className="flex min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <main className="ml-56 flex-1 overflow-hidden flex flex-col">
          <RedTeam />
        </main>
      </div>
    </ProtectedRoute>
  );
}
