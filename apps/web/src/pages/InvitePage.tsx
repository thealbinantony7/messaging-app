import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { useUIStore } from '../stores/ui';

export function InvitePage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { addConversation } = useChatStore();
    const { setActiveConversation } = useUIStore();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [error, setError] = useState<string>('');

    useEffect(() => {
        async function joinConversation() {
            if (!token) {
                setStatus('error');
                setError('Invalid invite link');
                return;
            }

            if (!user) {
                // Redirect to login with return URL
                navigate(`/login?redirect=/invite/${token}`);
                return;
            }

            try {
                const result = await api.joinViaInvite(token);
                addConversation(result.conversation);
                setStatus('success');

                // Redirect to conversation after a brief delay
                setTimeout(() => {
                    setActiveConversation(result.conversationId);
                    navigate('/');
                }, 1000);
            } catch (err) {
                setStatus('error');
                setError(err instanceof Error ? err.message : 'Failed to join conversation');
            }
        }

        joinConversation();
    }, [token, user, navigate, addConversation, setActiveConversation]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: '#080808',
            color: '#fff',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{
                textAlign: 'center',
                padding: '2rem'
            }}>
                {status === 'loading' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                        <h1>Joining conversation...</h1>
                    </>
                )}
                {status === 'success' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                        <h1>Success!</h1>
                        <p style={{ opacity: 0.7 }}>Redirecting to conversation...</p>
                    </>
                )}
                {status === 'error' && (
                    <>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                        <h1>Failed to join</h1>
                        <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>{error}</p>
                        <button
                            onClick={() => navigate('/')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: '#2563eb',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '1rem'
                            }}
                        >
                            Go to Home
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
