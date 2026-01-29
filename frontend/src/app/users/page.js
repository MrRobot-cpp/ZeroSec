"use client";
import Sidebar from "@/components/Sidebar";
import UsersAccessControl from "@/components/UsersAccessControl";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function UsersPage() {
  return (
    <ProtectedRoute requiredPermission="admin">
      <div className="flex min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <main className="flex-1 p-6">
          <UsersAccessControl />
        </main>
      </div>
    </ProtectedRoute>
  );
}
