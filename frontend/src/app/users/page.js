"use client";
import Sidebar from "@/components/Sidebar";
import UsersAccessControl from "@/components/UsersAccessControl";

export default function UsersPage() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 p-6">
        <UsersAccessControl />
      </main>
    </div>
  );
}
