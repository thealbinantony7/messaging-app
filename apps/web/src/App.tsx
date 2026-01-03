import { useEffect } from 'react';
/* Deployment update: 2026-01-03 21:26 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';
import { useUIStore } from './stores/ui';
import { AuthScreen } from './components/auth/AuthScreen';
import { ChatLayout } from './components/layout/ChatLayout';
import { InvitePage } from './pages/InvitePage';
import { Toaster } from './components/ui/Toaster';

export default function App() {
    const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
    const { theme } = useUIStore();

    useEffect(() => {
        // Check for existing session on mount
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Loading state
    if (isLoading) {
        return (
            <div className="app app-loading">
                <div className="app-loading-spinner" />
            </div>
        );
    }

    return (
        <BrowserRouter>
            <div className="app">
                <Routes>
                    <Route path="/invite/:token" element={<InvitePage />} />
                    <Route
                        path="/login"
                        element={isAuthenticated ? <Navigate to="/" replace /> : <AuthScreen />}
                    />
                    <Route
                        path="/"
                        element={isAuthenticated ? <ChatLayout /> : <AuthScreen />}
                    />
                </Routes>
                <Toaster />
            </div>
        </BrowserRouter>
    );
}
