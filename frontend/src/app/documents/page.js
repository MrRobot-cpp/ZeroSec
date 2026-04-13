"use client";
import Sidebar from "@/components/Sidebar";
import Documents from "@/components/Documents";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function DocumentsPage() {
  return (
    <ProtectedRoute requiredPermission="document_view">
      <div className="flex min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <main className="ml-64 flex-1 p-6">
          <Documents />
        </main>
      </div>
    </ProtectedRoute>
  );
}
