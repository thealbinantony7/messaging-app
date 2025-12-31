import { useState } from 'react';
import { X, User, Users, Mail, Loader2 } from 'lucide-react';
import { useUIStore } from '../../stores/ui';
import { api } from '../../lib/api';
import './NewChatModal.css';

export function NewChatModal() {
    const { closeModal, setActiveConversation } = useUIStore();
    const [type, setType] = useState<'dm' | 'group'>('dm');
    const [name, setName] = useState('');
    const [emails, setEmails] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddEmail = () => {
        if (emails.length < 10) {
            setEmails([...emails, '']);
        }
    };

    const handleRemoveEmail = (index: number) => {
        if (emails.length > 1) {
            const newEmails = [...emails];
            newEmails.splice(index, 1);
            setEmails(newEmails);
        }
    };

    const handleEmailChange = (index: number, value: string) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const validEmails = emails.filter(e => e.trim().length > 0);
            if (validEmails.length === 0) {
                throw new Error('Please enter at least one email address');
            }

            if (type === 'group' && !name.trim()) {
                throw new Error('Group name is required');
            }

            const { conversationId } = await api.createConversation({
                type,
                emails: validEmails,
                name: type === 'group' ? name.trim() : undefined
            });

            setActiveConversation(conversationId);
            closeModal();
        } catch (err: any) {
            setError(err.message || 'Failed to create conversation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content new-chat-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>New Conversation</h2>
                    <button className="modal-close-btn" onClick={closeModal}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-tabs">
                        <button
                            type="button"
                            className={`modal-tab ${type === 'dm' ? 'active' : ''}`}
                            onClick={() => {
                                setType('dm');
                                setEmails([emails[0] || '']);
                            }}
                        >
                            <User size={18} />
                            Private
                        </button>
                        <button
                            type="button"
                            className={`modal-tab ${type === 'group' ? 'active' : ''}`}
                            onClick={() => setType('group')}
                        >
                            <Users size={18} />
                            Group
                        </button>
                    </div>

                    <div className="modal-body">
                        {type === 'group' && (
                            <div className="form-group">
                                <label>Group Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Project Alpha"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>{type === 'group' ? 'Member Emails' : 'Recipient Email'}</label>
                            <div className="email-list">
                                {emails.map((email, index) => (
                                    <div key={index} className="email-input-row">
                                        <div className="input-with-icon">
                                            <Mail size={16} className="input-icon" />
                                            <input
                                                type="email"
                                                placeholder="email@example.com"
                                                value={email}
                                                onChange={e => handleEmailChange(index, e.target.value)}
                                                required
                                            />
                                        </div>
                                        {type === 'group' && emails.length > 1 && (
                                            <button
                                                type="button"
                                                className="remove-email-btn"
                                                onClick={() => handleRemoveEmail(index)}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {type === 'group' && emails.length < 10 && (
                                <button
                                    type="button"
                                    className="add-email-btn"
                                    onClick={handleAddEmail}
                                >
                                    + Add another email
                                </button>
                            )}
                        </div>

                        {error && <div className="modal-error">{error}</div>}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={closeModal}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Create Conversation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
