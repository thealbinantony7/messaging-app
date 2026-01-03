import { useEffect, useState, useMemo } from 'react';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import './TypingIndicator.css';

interface Props {
    conversationId: string;
}

const TYPING_TIMEOUT = 3000; // Clear if no update for 3 seconds

export function TypingIndicator({ conversationId }: Props) {
    const { user } = useAuthStore();
    const typingUserIds = useChatStore((state) => state.typingUsers[conversationId] || []);
    const conversation = useChatStore((state) => state.conversations.find((c) => c.id === conversationId));
    const [visibleTypingIds, setVisibleTypingIds] = useState<string[]>([]);

    // Auto-clear typing indicators after timeout
    useEffect(() => {
        if (typingUserIds.length === 0) {
            setVisibleTypingIds([]);
            return;
        }

        // Update visible typing IDs
        setVisibleTypingIds(typingUserIds);

        // Set timeout to clear
        const timeout = setTimeout(() => {
            setVisibleTypingIds([]);
        }, TYPING_TIMEOUT);

        return () => clearTimeout(timeout);
    }, [typingUserIds]);

    // PHASE 8.7: Memoized typing text to avoid re-renders
    const displayText = useMemo(() => {
        // Filter out current user and inactive members
        const activeTypingUsers = visibleTypingIds.filter((id) => {
            if (id === user?.id) return false; // Exclude self

            // Find member in conversation
            const member = conversation?.members.find((m) => m.userId === id);
            if (!member) return false; // Not a member
            if (!member.joinedAt) return false; // Left the group

            return true;
        });

        if (activeTypingUsers.length === 0) return null;

        // Get typing user names
        const typingNames = conversation?.members
            .filter((m) => activeTypingUsers.includes(m.userId))
            .map((m) => m.user.displayName || m.user.email.split('@')[0]) || [];

        if (typingNames.length === 0) return null;

        // PHASE 8.7: WhatsApp-style formatting
        if (typingNames.length === 1) {
            return `${typingNames[0]} is typing…`;
        } else if (typingNames.length === 2) {
            return `${typingNames[0]} and ${typingNames[1]} are typing…`;
        } else {
            // 3+ users: show first name + "and others"
            return `${typingNames[0]} and others are typing…`;
        }
    }, [visibleTypingIds, conversation, user?.id]);

    if (!displayText) return null;

    return (
        <div className="typing-indicator">
            <span className="typing-text">{displayText}</span>
        </div>
    );
}
