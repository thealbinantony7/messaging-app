import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Settings, Plus, MessageSquare, Command } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import { useUIStore } from '../../stores/ui';
import { useChatStore } from '../../stores/chat';
import { ConversationItem } from '../chat/ConversationItem';
import { APP_CONFIG } from '@linkup/shared/config';
import './Sidebar.css';

export function Sidebar() {
    const [searchQuery, setSearchQuery] = useState('');
    const { user } = useAuthStore();
    const { openModal } = useUIStore();
    const { conversations, conversationsLoading, fetchConversations } = useChatStore();

    // Fetch conversations on mount
    useEffect(() => {
        fetchConversations();
    }, [fetchConversations]);

    // Subscribe to conversations for real-time updates
    useEffect(() => {
        if (conversations && conversations.length > 0) {
            import('../../lib/ws').then(({ wsClient }) => {
                wsClient.subscribe(conversations.map(c => c.id));
            });
        }
    }, [conversations]);

    // Filter conversations by search
    const filteredConversations = useMemo(() => {
        if (!conversations) return [];
        if (!searchQuery.trim()) return conversations;
        const query = searchQuery.toLowerCase();
        return conversations.filter((conv) => {
            // Search by name or member names
            if (conv.name?.toLowerCase().includes(query)) return true;
            return conv.members.some((m) =>
                m.user.displayName.toLowerCase().includes(query)
            );
        });
    }, [conversations, searchQuery]);

    // Separate chats and channels
    const chats = useMemo(() =>
        filteredConversations.filter(c => c.type === 'dm' || c.type === 'group'),
        [filteredConversations]
    );

    const channels = useMemo(() =>
        filteredConversations.filter(c => c.type === 'channel'),
        [filteredConversations]
    );

    return (
        <div className="sidebar">
            {/* Header */}
            <div className="sidebar-header">
                <div className="sidebar-brand">
                    <Command className="sidebar-brand-icon" size={24} />
                    <h1 className="sidebar-title">{APP_CONFIG.name}</h1>
                </div>
                <div className="sidebar-header-actions">
                    <button
                        className="sidebar-icon-btn"
                        onClick={() => openModal('new-chat')}
                        aria-label="New chat"
                    >
                        <Plus size={20} />
                    </button>
                    <button
                        className="sidebar-icon-btn"
                        onClick={() => openModal('settings')}
                        aria-label="Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="sidebar-search">
                <Search className="sidebar-search-icon" size={18} />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="sidebar-search-input"
                />
            </div>

            {/* Conversation list */}
            <div className="sidebar-list">
                {/* Chats Section */}
                <div className="sidebar-label">Chats</div>

                {conversationsLoading ? (
                    // Loading skeletons
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="conversation-skeleton">
                            <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%' }} />
                            <div className="conversation-skeleton-content">
                                <div className="skeleton" style={{ width: '60%', height: 14 }} />
                                <div className="skeleton" style={{ width: '80%', height: 12, marginTop: 8 }} />
                            </div>
                        </div>
                    ))
                ) : chats.length === 0 && !searchQuery ? (
                    <div className="sidebar-empty">
                        <MessageSquare size={32} />
                        <p>No conversations yet</p>
                        <button
                            className="sidebar-empty-btn"
                            onClick={() => openModal('new-chat')}
                        >
                            Start a conversation
                        </button>
                    </div>
                ) : (
                    <motion.div layout>
                        {chats.map((conversation) => (
                            <ConversationItem
                                key={conversation.id}
                                conversation={conversation}
                            />
                        ))}
                    </motion.div>
                )}

                {/* Channels Section */}
                {channels.length > 0 && (
                    <>
                        <div className="sidebar-label" style={{ marginTop: 16 }}>Channels</div>
                        <motion.div layout>
                            {channels.map((conversation) => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                />
                            ))}
                        </motion.div>
                    </>
                )}
            </div>

            {/* User profile */}
            <div className="sidebar-profile glass">
                <div className="sidebar-profile-avatar">
                    {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} />
                    ) : (
                        <div className="sidebar-profile-avatar-fallback">
                            {user?.displayName.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <span className="sidebar-profile-status" />
                </div>
                <div className="sidebar-profile-info">
                    <span className="sidebar-profile-name truncate">{user?.displayName}</span>
                    <span className="sidebar-profile-email truncate">{user?.email}</span>
                </div>
            </div>
        </div>
    );
}
