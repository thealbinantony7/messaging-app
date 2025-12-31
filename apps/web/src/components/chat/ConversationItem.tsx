import { memo } from 'react';
import { motion } from 'framer-motion';
import type { ConversationWithMembers } from '@linkup/shared';
import { useUIStore } from '../../stores/ui';
import { useAuthStore } from '../../stores/auth';
import { formatDistanceToNow } from '../../lib/utils';
import './ConversationItem.css';

interface Props {
    conversation: ConversationWithMembers;
}

export const ConversationItem = memo(function ConversationItem({ conversation }: Props) {
    const { activeConversationId, setActiveConversation } = useUIStore();
    const { user } = useAuthStore();
    const isActive = activeConversationId === conversation.id;

    // Get display name and avatar
    const getDisplayInfo = () => {
        if (conversation.type === 'channel' || conversation.type === 'group') {
            return {
                name: conversation.name || (conversation.type === 'channel' ? 'Channel' : 'Group Chat'),
                avatar: conversation.avatarUrl,
            };
        }
        // For DMs, show the other person
        const otherMember = conversation.members.find((m) => m.userId !== user?.id);
        return {
            name: otherMember?.user.displayName || 'Unknown',
            avatar: otherMember?.user.avatarUrl,
        };
    };

    const { name, avatar } = getDisplayInfo();
    const lastMessage = conversation.lastMessage;
    const hasUnread = conversation.unreadCount > 0;

    return (
        <motion.button
            className={`conversation-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
            onClick={() => setActiveConversation(conversation.id)}
            whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
            whileTap={{ scale: 0.99 }}
        >
            {/* Avatar */}
            <div className="conversation-avatar">
                {avatar ? (
                    <img src={avatar} alt={name} />
                ) : (
                    <div className="conversation-avatar-fallback">
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                {conversation.type === 'group' && (
                    <span className="conversation-group-badge">
                        {conversation.members.length}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="conversation-content">
                <div className="conversation-header">
                    <span className="conversation-name truncate">{name}</span>
                    {lastMessage && (
                        <span className="conversation-time">
                            {formatDistanceToNow(lastMessage.createdAt)}
                        </span>
                    )}
                </div>
                <div className="conversation-preview">
                    {lastMessage ? (
                        <span className="truncate">
                            {lastMessage.senderId === user?.id && (
                                <span className="conversation-you">You: </span>
                            )}
                            {lastMessage.deletedAt
                                ? 'Message deleted'
                                : lastMessage.content || `[${lastMessage.type}]`}
                        </span>
                    ) : (
                        <span className="conversation-empty">No messages yet</span>
                    )}
                    {hasUnread && (
                        <span className="conversation-badge">{conversation.unreadCount}</span>
                    )}
                </div>
            </div>
        </motion.button>
    );
});
