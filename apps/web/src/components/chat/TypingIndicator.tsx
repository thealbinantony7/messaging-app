import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import './TypingIndicator.css';

interface Props {
    conversationId: string;
}

export function TypingIndicator({ conversationId }: Props) {
    const { user } = useAuthStore();
    const typingUserIds = useChatStore((state) => state.typingUsers[conversationId] || []);
    const conversation = useChatStore((state) => state.conversations.find((c) => c.id === conversationId));

    if (typingUserIds.length === 0) return null;

    // Get the first typing user's name (excluding current user)
    const typingUser = conversation?.members.find(
        (m) => typingUserIds.includes(m.id) && m.id !== user?.id
    );

    if (!typingUser) return null;

    const displayName = typingUser.user.displayName || typingUser.user.email.split('@')[0];

    return (
        <div className="typing-indicator">
            <span className="typing-text">{displayName} is typing…</span>
        </div>
    );
}
