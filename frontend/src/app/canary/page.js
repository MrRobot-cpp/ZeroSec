"use client";
import Sidebar from "@/components/Sidebar";
import React, { useRef, useState } from "react";
import CanaryWatermark from "@/components/CanaryWatermark";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function CanaryPage() {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <ProtectedRoute requiredPermission="create">
      <div className="flex min-h-screen bg-gray-900 text-white">
        <Sidebar />
        <main className="flex-1 p-6 flex flex-col">
          <div className="h-full flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <div className="bg-gray-800 border-b border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white mb-2">
                    Canary Watermark
                  </h1>
                  <p className="text-gray-400 text-sm">
                    Upload a .pdf, .docx, or .txt file to embed a forensic canary
                    watermark for security and auditability.
                  </p>
                </div>
                <div>
                  <button
                    onClick={handleClick}
                    className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium cursor-pointer transition-all duration-200 inline-flex items-center gap-2 ${uploading ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    disabled={uploading}
                  >
                    <span>🔒</span>
                    {uploading ? "Uploading..." : "Watermark Document"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <CanaryWatermark fileInputRef={fileInputRef} setUploading={setUploading} uploading={uploading} />
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
