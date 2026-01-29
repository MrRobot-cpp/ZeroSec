"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import authService from "@/services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Initialize from localStorage on mount
    useEffect(() => {
        const storedUser = authService.getUser();
        if (storedUser) {
            setUser(storedUser);
        }
        setLoading(false);
    }, []);

    // Login and update context
    const login = useCallback(async (username, password) => {
        const result = await authService.login(username, password);
        setUser(result.user);
        return result;
    }, []);

    // Logout and clear context
    const logout = useCallback(async () => {
        await authService.logout();
        setUser(null);
    }, []);

    // Check if user has a specific permission
    const hasPermission = useCallback((permission) => {
        if (!user?.permissions) return false;
        // Super Admin has 'admin' permission which grants full access
        if (user.permissions.includes('admin')) return true;
        return user.permissions.includes(permission);
    }, [user]);

    // Check if user has a specific role
    const hasRole = useCallback((role) => {
        if (!user?.roles) return false;
        return user.roles.includes(role);
    }, [user]);

    // Check if user is authenticated
    const isAuthenticated = useCallback(() => {
        return !!user && authService.isAuthenticated();
    }, [user]);

    // Refresh user data from backend
    const refreshUser = useCallback(async () => {
        try {
            const userData = await authService.getCurrentUser();
            setUser(userData);
            return userData;
        } catch (error) {
            console.error("Failed to refresh user:", error);
            setUser(null);
            throw error;
        }
    }, []);

    const value = {
        user,
        loading,
        login,
        logout,
        hasPermission,
        hasRole,
        isAuthenticated,
        refreshUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export default AuthContext;
