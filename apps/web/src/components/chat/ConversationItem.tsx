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
            className={`conversation-item ${isActive ? 'active !bg-white/10' : ''} ${hasUnread ? 'unread' : ''} !rounded-xl !mx-2 !my-0.5 !py-3 !px-3 hover:!bg-white/5 transition-colors duration-200`}
            onClick={() => setActiveConversation(conversation.id)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
        >
            {/* Avatar */}
            <div className="conversation-avatar !w-12 !h-12 border border-white/5 shadow-sm">
                {avatar ? (
                    <img src={avatar} alt={name} />
                ) : (
                    <div className="conversation-avatar-fallback !bg-zinc-800 !text-zinc-400">
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                {conversation.type === 'group' && (
                    <span className="conversation-group-badge border border-[#1a1a1a]">
                        {conversation.members.length}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="conversation-content ml-3 border-b border-white/5 pb-3">
                <div className="conversation-header mb-0.5">
                    <span className="conversation-name truncate !text-[15px] !font-medium !text-zinc-100">{name}</span>
                    {lastMessage && (
                        <span className="conversation-time !text-[12px] !font-normal !text-zinc-500">
                            {formatDistanceToNow(lastMessage.createdAt)}
                        </span>
                    )}
                </div>
                <div className="conversation-preview">
                    {lastMessage ? (
                        <span className="truncate !text-[14px] !text-zinc-400 font-normal">
                            {lastMessage.senderId === user?.id && (
                                <span className="conversation-you !text-zinc-500">You: </span>
                            )}
                            {lastMessage.deletedAt
                                ? 'Message deleted'
                                : lastMessage.type === 'image' ? '📷 Photo'
                                    : lastMessage.type === 'video' ? '🎥 Video'
                                        : lastMessage.type === 'voice' ? '🎤 Voice message'
                                            : lastMessage.content || `[${lastMessage.type}]`}
                        </span>
                    ) : (
                        <span className="conversation-empty !text-[14px]">No messages yet</span>
                    )}
                    {hasUnread && (
                        <span className="conversation-badge !bg-blue-600 !h-5 !min-w-[20px] !text-[11px] shadow-sm shadow-blue-900/20">{conversation.unreadCount}</span>
                    )}
                </div>
            </div>
        </motion.button>
    );
});
