import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@linkup/shared';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';

interface AuthState {
    user: User | null;
    accessToken: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    // Actions
    login: (request: import('@linkup/shared').LoginRequest) => Promise<{ success: boolean; error?: string }>;
    register: (request: import('@linkup/shared').RegisterRequest) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    updateUser: (updates: Partial<User>) => void;
    refreshTokens: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: true,

            login: async (request) => {
                try {
                    const result = await api.login(request);

                    set({
                        user: result.user,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Connect WebSocket
                    wsClient.connect(result.accessToken);

                    return { success: true };
                } catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Login failed' };
                }
            },

            register: async (request) => {
                try {
                    const result = await api.register(request);

                    set({
                        user: result.user,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Connect WebSocket
                    wsClient.connect(result.accessToken);

                    return { success: true };
                } catch (err) {
                    return { success: false, error: err instanceof Error ? err.message : 'Registration failed' };
                }
            },

            logout: async () => {
                const { refreshToken } = get();

                // Disconnect WebSocket first
                wsClient.disconnect();

                if (refreshToken) {
                    try {
                        await api.logout(refreshToken);
                    } catch (err) {
                        console.error('Logout API error:', err);
                    }
                }

                set({
                    user: null,
                    accessToken: null,
                    refreshToken: null,
                    isAuthenticated: false,
                    isLoading: false,
                });

                // Clear persisted state
                localStorage.removeItem('linkup-auth');
            },

            checkAuth: async () => {
                const { accessToken, refreshToken } = get();

                if (!accessToken || !refreshToken) {
                    set({ isLoading: false, isAuthenticated: false });
                    return;
                }

                // Set token in API client
                api.setAccessToken(accessToken);

                try {
                    // Try to get current user
                    const { user } = await api.getMe();
                    set({ user, isAuthenticated: true, isLoading: false });

                    // Connect WebSocket
                    wsClient.connect(accessToken);
                } catch (err) {
                    // Token might be expired, try to refresh
                    const refreshed = await get().refreshTokens();
                    if (!refreshed) {
                        set({
                            user: null,
                            accessToken: null,
                            refreshToken: null,
                            isAuthenticated: false,
                            isLoading: false,
                        });
                    }
                }
            },

            refreshTokens: async () => {
                const { refreshToken } = get();

                if (!refreshToken) {
                    return false;
                }

                try {
                    const result = await api.refresh(refreshToken);

                    set({
                        user: result.user,
                        accessToken: result.accessToken,
                        refreshToken: result.refreshToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Reconnect WebSocket with new token
                    wsClient.disconnect();
                    wsClient.connect(result.accessToken);

                    return true;
                } catch (err) {
                    console.error('Token refresh failed:', err);
                    return false;
                }
            },

            updateUser: (updates) => {
                const { user } = get();
                if (user) {
                    set({ user: { ...user, ...updates } });
                }
            },
        }),
        {
            name: 'linkup-auth',
            partialize: (state) => ({
                user: state.user,
                accessToken: state.accessToken,
                refreshToken: state.refreshToken,
            }),
            onRehydrateStorage: () => (state) => {
                // Set token in API client after rehydration
                if (state?.accessToken) {
                    api.setAccessToken(state.accessToken);
                }
            },
        }
    )
);
