import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useUIStore } from '../../stores/ui';
import './Toaster.css';

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
    warning: AlertTriangle,
};

export function Toaster() {
    const { toasts, removeToast } = useUIStore();

    return (
        <div className="toaster">
            <AnimatePresence>
                {toasts.map((toast) => {
                    const Icon = icons[toast.type];
                    return (
                        <motion.div
                            key={toast.id}
                            className={`toast toast-${toast.type} glass`}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                        >
                            <Icon className="toast-icon" size={18} />
                            <span className="toast-message">{toast.message}</span>
                            <button
                                className="toast-close"
                                onClick={() => removeToast(toast.id)}
                                aria-label="Dismiss"
                            >
                                <X size={16} />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
