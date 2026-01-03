import { useEffect, useState } from 'react';
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

    // Filter out current user
    const otherUsersTyping = visibleTypingIds.filter((id) => id !== user?.id);

    if (otherUsersTyping.length === 0) return null;

    // Get typing user names
    const typingMembers = conversation?.members
        .filter((m) => otherUsersTyping.includes(m.userId))
        .map((m) => m.user.displayName || m.user.email.split('@')[0]) || [];

    if (typingMembers.length === 0) return null;

    // Format display text
    let displayText: string;
    if (typingMembers.length === 1) {
        displayText = `${typingMembers[0]} is typing…`;
    } else if (typingMembers.length === 2) {
        displayText = `${typingMembers[0]}, ${typingMembers[1]} are typing…`;
    } else {
        displayText = `${typingMembers[0]} and others are typing…`;
    }

    return (
        <div className="typing-indicator">
            <span className="typing-text">{displayText}</span>
        </div>
    );
}
