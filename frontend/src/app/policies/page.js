"use client";
import Policies from "@/components/Policies";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function PoliciesPage() {
  return (
    <ProtectedRoute requiredPermission="policy_manage">
      <Policies />
    </ProtectedRoute>
  );
}
