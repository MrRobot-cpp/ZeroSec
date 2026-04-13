"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import RagChat from "@/components/RagChat";
import EncryptedRagChat from "@/components/EncryptedRagChat";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function RagPage() {
  const [activeTab, setActiveTab] = useState("standard");

  return (
    <ProtectedRoute requiredPermission="rag_query">
      <div className="flex min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <main className="ml-64 flex-1 p-6 flex flex-col h-screen">

          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 bg-gray-800/50 rounded-lg p-1 w-fit border border-gray-700/50 shrink-0">
            <button
              onClick={() => setActiveTab("standard")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "standard"
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              Standard Chat
            </button>
            <button
              onClick={() => setActiveTab("encrypted")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === "encrypted"
                  ? "bg-gray-700 text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
                }`}
            >
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              Encrypted Chat
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                HIGH
              </span>
            </button>
          </div>

          {/* Chat panel — fills remaining height, scrolls internally */}
          <div className="flex-1 min-h-0">
            {activeTab === "standard" ? <RagChat /> : <EncryptedRagChat />}
          </div>

        </main>
      </div>
    </ProtectedRoute>
  );
}
