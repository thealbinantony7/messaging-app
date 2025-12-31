import { create } from 'zustand';

type Theme = 'dark' | 'light';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    duration?: number;
}

interface UIState {
    // Theme
    theme: Theme;
    setTheme: (theme: Theme) => void;

    // Sidebar
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;

    // Active conversation
    activeConversationId: string | null;
    setActiveConversation: (id: string | null) => void;

    // Modals
    activeModal: string | null;
    modalData: unknown;
    openModal: (modal: string, data?: unknown) => void;
    closeModal: () => void;

    // Toasts
    toasts: Toast[];
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;

    // Mobile
    isMobile: boolean;
    setIsMobile: (isMobile: boolean) => void;
}

let toastId = 0;

export const useUIStore = create<UIState>((set) => ({
    // Theme - default dark
    theme: 'dark',
    setTheme: (theme) => set({ theme }),

    // Sidebar - default open
    sidebarOpen: true,
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    // Active conversation
    activeConversationId: null,
    setActiveConversation: (activeConversationId) => set({ activeConversationId }),

    // Modals
    activeModal: null,
    modalData: null,
    openModal: (activeModal, modalData = null) => set({ activeModal, modalData }),
    closeModal: () => set({ activeModal: null, modalData: null }),

    // Toasts
    toasts: [],
    addToast: (toast) => {
        const id = `toast-${++toastId}`;
        set((state) => ({
            toasts: [...state.toasts, { ...toast, id }],
        }));

        // Auto-remove after duration
        const duration = toast.duration ?? 4000;
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id),
            }));
        }, duration);
    },
    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        }));
    },

    // Mobile
    isMobile: false,
    setIsMobile: (isMobile) => set({ isMobile }),
}));
