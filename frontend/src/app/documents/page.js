"use client";
import Sidebar from "@/components/Sidebar";
import Documents from "@/components/Documents";

export default function DocumentsPage() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 p-6">
        <Documents />
      </main>
    </div>
  );
}
