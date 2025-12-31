import { MessageSquarePlus } from 'lucide-react';
import { useUIStore } from '../../stores/ui';
import './EmptyState.css';

export function EmptyState() {
    const { openModal } = useUIStore();

    return (
        <div className="empty-state">
            <div className="empty-state-content">
                <div className="empty-state-icon">
                    <MessageSquarePlus size={48} />
                </div>
                <h2 className="empty-state-title">No conversations yet</h2>
                <p className="empty-state-text">
                    Start a private conversation or create a small group.
                </p>
                <div className="empty-state-actions">
                    <button
                        className="empty-state-btn"
                        onClick={() => openModal('new-chat')}
                    >
                        <MessageSquarePlus size={18} />
                        Start a conversation
                    </button>
                    <p className="empty-state-helper">
                        You can invite people by email.
                    </p>
                </div>
            </div>
        </div>
    );
}
