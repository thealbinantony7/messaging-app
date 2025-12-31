import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Command, Lock, User } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { APP_CONFIG } from '@linkup/shared/config';
import './AuthScreen.css';

export function AuthScreen() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login, register } = useAuthStore();
    const { addToast } = useUIStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.includes('@')) {
            addToast({ type: 'error', message: 'Please enter a valid email address' });
            return;
        }

        if (password.length < 8) {
            addToast({ type: 'error', message: 'Password must be at least 8 characters' });
            return;
        }

        if (mode === 'register' && displayName.length < 2) {
            addToast({ type: 'error', message: 'Name must be at least 2 characters' });
            return;
        }

        setIsLoading(true);

        let result;
        if (mode === 'login') {
            result = await login({ email, password });
        } else {
            result = await register({ email, password, displayName });
        }

        setIsLoading(false);

        if (!result.success) {
            addToast({ type: 'error', message: result.error || 'Authentication failed' });
        }
    };

    const toggleMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setPassword('');
    };

    // Minimal spring physics
    const springConfig = { type: 'spring', stiffness: 300, damping: 30 };

    return (
        <div className="auth-screen">
            <motion.div
                className="auth-container glass"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={springConfig}
            >
                {/* Logo */}
                <div className="auth-logo">
                    <Command className="auth-logo-icon" size={24} />
                    <h1 className="auth-title">{APP_CONFIG.name}</h1>
                </div>

                <p className="auth-subtitle">{APP_CONFIG.description}</p>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="auth-form-content">
                        {mode === 'register' && (
                            <motion.div
                                className="auth-input-group"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <User className="auth-input-icon" size={18} />
                                <input
                                    type="text"
                                    placeholder="Full Name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="auth-input"
                                    required={mode === 'register'}
                                />
                            </motion.div>
                        )}

                        <div className="auth-input-group">
                            <Mail className="auth-input-icon" size={18} />
                            <input
                                type="email"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="auth-input"
                                required
                            />
                        </div>

                        <div className="auth-input-group">
                            <Lock className="auth-input-icon" size={18} />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="auth-input"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="auth-button"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <span className="auth-button-loading" />
                        ) : (
                            <>
                                {mode === 'login' ? 'Sign In' : 'Create Account'}
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    <div className="auth-footer">
                        <p className="auth-switch-text">
                            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                        </p>
                        <button
                            type="button"
                            className="auth-switch-button"
                            onClick={toggleMode}
                        >
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
