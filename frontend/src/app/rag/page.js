"use client";
import Sidebar from "@/components/Sidebar";
import RagChat from "@/components/RagChat";

export default function RagPage() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="h-[calc(100vh-3rem)]">
          <RagChat />
        </div>
      </main>
    </div>
  );
}
