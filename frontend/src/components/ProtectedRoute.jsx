"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import PropTypes from "prop-types";
import { useAuth } from "@/context/AuthContext";

/**
 * ProtectedRoute component that checks authentication and permissions
 * Redirects to login if not authenticated, shows access denied if no permission
 */
export default function ProtectedRoute({
    children,
    requiredPermission = null,
    requiredRole = null,
    fallback = null
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, isAuthenticated, hasPermission, hasRole } = useAuth();

    useEffect(() => {
        if (loading) return;

        // Redirect to login if not authenticated
        if (!isAuthenticated()) {
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        // Check permission
        if (requiredPermission && !hasPermission(requiredPermission)) {
            // User doesn't have permission - could redirect or show message
            return;
        }

        // Check role
        if (requiredRole && !hasRole(requiredRole)) {
            return;
        }
    }, [loading, isAuthenticated, hasPermission, hasRole, requiredPermission, requiredRole, router, pathname]);

    // Show loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div className="text-gray-400">Loading...</div>
            </div>
        );
    }

    // Not authenticated - will redirect
    if (!isAuthenticated()) {
        return null;
    }

    // Check permission access
    if (requiredPermission && !hasPermission(requiredPermission)) {
        return fallback || (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1>
                    <p className="text-gray-400">You don&apos;t have permission to access this page.</p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Check role access
    if (requiredRole && !hasRole(requiredRole)) {
        return fallback || (
            <div className="flex items-center justify-center min-h-screen bg-gray-900">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Access Denied</h1>
                    <p className="text-gray-400">You don&apos;t have the required role to access this page.</p>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return children;
}

ProtectedRoute.propTypes = {
    children: PropTypes.node.isRequired,
    requiredPermission: PropTypes.string,
    requiredRole: PropTypes.string,
    fallback: PropTypes.node,
};
