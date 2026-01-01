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
            className={`group w-full max-w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
            onClick={() => setActiveConversation(conversation.id)}
            layout={false} // Disable layout animation
        >
            {/* Avatar */}
            <div className="relative shrink-0 w-12 h-12">
                {avatar ? (
                    <img src={avatar} alt={name} className="w-full h-full object-cover rounded-full bg-secondary" />
                ) : (
                    <div className="flex items-center justify-center w-full h-full rounded-full bg-secondary text-secondary-foreground text-lg font-medium">
                        {name.charAt(0).toUpperCase()}
                    </div>
                )}
                {conversation.type === 'group' && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-secondary text-[10px] font-bold">
                        {conversation.members.length}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm font-medium ${isActive ? 'text-accent-foreground' : 'text-foreground'}`}>
                        {name}
                    </span>
                    {lastMessage && (
                        <span className={`shrink-0 text-[11px] ${isActive ? 'text-accent-foreground/70' : 'text-muted-foreground'}`}>
                            {formatDistanceToNow(lastMessage.createdAt)}
                        </span>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    {lastMessage ? (
                        <span className={`truncate text-xs ${isActive ? 'text-accent-foreground/80' : 'text-muted-foreground'}`}>
                            {lastMessage.senderId === user?.id && "You: "}
                            {lastMessage.deletedAt
                                ? 'Message deleted'
                                : lastMessage.type === 'image' ? 'Example Photo' // Placeholder for logic
                                    : lastMessage.content}
                        </span>
                    ) : (
                        <span className="truncate text-xs text-muted-foreground">No messages yet</span>
                    )}
                    {hasUnread && (
                        <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {conversation.unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </motion.button>
    );
});
