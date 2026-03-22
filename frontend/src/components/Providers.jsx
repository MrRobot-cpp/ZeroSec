"use client";
import { AuthProvider } from "@/context/AuthContext";
import PropTypes from "prop-types";

/**
 * Client-side providers wrapper
 * Separates client-side context providers from server components
 */
export default function Providers({ children }) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    );
}

Providers.propTypes = {
    children: PropTypes.node.isRequired,
};
