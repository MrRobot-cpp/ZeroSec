"use client";
import Settings from "@/components/Settings";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function SettingsPage() {
  return (
    <ProtectedRoute requiredPermission="admin">
      <Settings />
    </ProtectedRoute>
  );
}
