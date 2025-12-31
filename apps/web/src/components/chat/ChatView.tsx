import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, MoreVertical, Search, Paperclip, Mic, Send, Smile, Sparkles, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../stores/ui';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import './ChatView.css';

interface Props {
    conversationId: string;
}

export function ChatView({ conversationId }: Props) {
    const [message, setMessage] = useState('');
    const [showAiMenu, setShowAiMenu] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { setActiveConversation, isMobile, addToast } = useUIStore();
    const { user } = useAuthStore();

    // Use separate selectors for better reactivity
    const conversationMessages = useChatStore((state) => state.messages[conversationId] || []);
    const pending = useChatStore((state) => state.pendingMessages[conversationId] || []);
    const deliveryReceipts = useChatStore((state) => state.deliveryReceipts);
    const seenReceipts = useChatStore((state) => state.seenReceipts);
    // Removed unused typing selector
    const isLoading = useChatStore((state) => state.messagesLoading[conversationId]);
    const conversation = useChatStore((state) => state.conversations.find((c) => c.id === conversationId));

    // Get actions (these are stable references)
    const fetchMessages = useChatStore((state) => state.fetchMessages);
    const sendMessage = useChatStore((state) => state.sendMessage);
    const retryMessage = useChatStore((state) => state.retryMessage);

    // Compute delivery/seen status for a message
    const getMessageStatus = (messageId: string): 'sent' | 'delivered' | 'read' => {
        // Skip channels - no delivery receipts for channels
        if (conversation?.type === 'channel') return 'sent';

        // Check if seen (read)
        const seenSet = seenReceipts[messageId];
        if (seenSet && seenSet.size > 0) {
            const otherMembers = conversation?.members.filter(m => m.userId !== user?.id) || [];
            const hasSeen = otherMembers.some(m => seenSet.has(m.userId));
            if (hasSeen) return 'read';
        }

        // Check if delivered
        const receipts = deliveryReceipts[messageId];
        if (!receipts || receipts.size === 0) return 'sent';

        // If at least one other user has received it, mark as delivered
        const otherMembers = conversation?.members.filter(m => m.userId !== user?.id) || [];
        const hasDelivery = otherMembers.some(m => receipts.has(m.userId));
        return hasDelivery ? 'delivered' : 'sent';
    };

    // Fetch messages on mount or id change
    useEffect(() => {
        fetchMessages(conversationId);
    }, [conversationId, fetchMessages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversationMessages.length, pending.length, conversationId]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [message]);

    // Cleanup typing timeouts on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
        };
    }, []);

    const handleTyping = () => {
        // Clear existing typing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Debounce: emit typing event after 500ms of input
        typingTimeoutRef.current = setTimeout(() => {
            import('../../lib/ws').then(({ wsClient }) => {
                wsClient.setTyping(conversationId, true);
            });

            // Auto-clear: stop typing after 3s of inactivity
            if (stopTypingTimeoutRef.current) {
                clearTimeout(stopTypingTimeoutRef.current);
            }
            stopTypingTimeoutRef.current = setTimeout(() => {
                import('../../lib/ws').then(({ wsClient }) => {
                    wsClient.setTyping(conversationId, false);
                });
            }, 3000);
        }, 500);
    };

    const handleSend = () => {
        if (!message.trim()) return;

        // Stop typing indicator
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (stopTypingTimeoutRef.current) clearTimeout(stopTypingTimeoutRef.current);
        import('../../lib/ws').then(({ wsClient }) => {
            wsClient.setTyping(conversationId, false);
        });

        sendMessage(conversationId, message.trim());
        setMessage('');
        setShowAiMenu(false);
        // Reset height
        if (inputRef.current) inputRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        handleTyping();
    };

    const handleRetry = (messageId: string) => {
        retryMessage(conversationId, messageId);
    };

    // Get display info
    const getDisplayInfo = () => {
        if (!conversation) return { name: 'Loading...', avatar: null, status: '' };
        if (conversation.type === 'channel') {
            return {
                name: conversation.name || 'Channel',
                avatar: conversation.avatarUrl,
                status: `${conversation.members.length} subscribers`,
            };
        }
        if (conversation.type === 'group') {
            return {
                name: conversation.name || 'Group Chat',
                avatar: conversation.avatarUrl,
                status: `${conversation.members.length} members`,
            };
        }
        const other = conversation.members.find((m) => m.userId !== user?.id);
        return {
            name: other?.user.displayName || 'Unknown',
            avatar: other?.user.avatarUrl,
            status: other?.user.lastSeenAt ? 'Active recently' : 'Offline',
        };
    };

    const displayInfo = getDisplayInfo();

    // Check if user can send messages (for channels, only admins can send)
    const canSendMessages = useMemo(() => {
        if (!conversation || !user) return false;
        if (conversation.type !== 'channel') return true;
        const member = conversation.members.find(m => m.userId === user.id);
        return member?.role === 'admin';
    }, [conversation, user]);

    return (
        <div className="chat-view">
            {/* Header */}
            <header className="chat-header glass">
                <div className="chat-header-left">
                    {isMobile && (
                        <button
                            className="chat-header-back"
                            onClick={() => setActiveConversation(null)}
                            aria-label="Back to conversations"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className="chat-header-avatar">
                        {displayInfo.avatar ? (
                            <img src={displayInfo.avatar} alt={displayInfo.name} />
                        ) : (
                            <div className="chat-header-avatar-fallback">
                                {displayInfo.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="chat-header-info">
                        <h2 className="chat-header-name">{displayInfo.name}</h2>
                        <span className="chat-header-status">{displayInfo.status}</span>
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button
                        className="chat-header-btn"
                        aria-label="Copy invite link"
                        onClick={async () => {
                            try {
                                const result = await import('../../lib/api').then(m => m.api.createInviteLink(conversationId));
                                await navigator.clipboard.writeText(result.inviteUrl);
                                addToast({ type: 'success', message: 'Invite link copied!' });
                            } catch (err) {
                                addToast({ type: 'error', message: 'Failed to create invite link' });
                            }
                        }}
                    >
                        <Link size={20} />
                    </button>
                    <button className="chat-header-btn" aria-label="Search">
                        <Search size={20} />
                    </button>
                    <button className="chat-header-btn" aria-label="More options">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <div className="chat-messages">
                {isLoading ? (
                    <div className="chat-messages-loading">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`message-skeleton ${i % 2 === 0 ? 'sent' : 'received'}`}>
                                <div className="skeleton" style={{ width: '60%', height: 40 }} />
                            </div>
                        ))}
                    </div>
                ) : conversationMessages.length === 0 && pending.length === 0 ? (
                    <div className="chat-messages-empty">
                        <p>No messages yet. Say hello! 👋</p>
                    </div>
                ) : (
                    <div className="chat-messages-list">
                        {conversationMessages.map((msg, index) => {
                            const prevMsg = index > 0 ? conversationMessages[index - 1] : null;
                            const isGrouped = !!(prevMsg && prevMsg.senderId === msg.senderId &&
                                (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 60000); // 1 minute

                            return (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.senderId === user?.id}
                                    status={msg.senderId === user?.id ? getMessageStatus(msg.id) : undefined}
                                    isGrouped={isGrouped}
                                />
                            );
                        })}
                        {pending.map((msg) => (
                            <MessageBubble
                                key={msg.id}
                                message={msg}
                                isOwn={true}
                                status={msg.status}
                                onRetry={msg.status === 'failed' ? () => handleRetry(msg.id) : undefined}
                                isGrouped={false}
                            />
                        ))}
                        <TypingIndicator conversationId={conversationId} />
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="chat-input glass">
                {!canSendMessages ? (
                    <div className="chat-input-readonly">
                        <p>Only admins can send messages in this channel</p>
                    </div>
                ) : (
                    <>
                        <button className="chat-input-btn" aria-label="Attach file">
                            <Paperclip size={20} />
                        </button>

                        <div className="chat-input-wrapper">
                            <textarea
                                ref={inputRef}
                                className="chat-input-field"
                                placeholder="Type a message..."
                                value={message}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                rows={1}
                            />

                            {/* AI rewrite button */}
                            {message.trim() && (
                                <div className="chat-input-ai">
                                    <button
                                        className="chat-input-ai-btn"
                                        onClick={() => setShowAiMenu(!showAiMenu)}
                                        aria-label="AI rewrite"
                                    >
                                        <Sparkles size={16} />
                                    </button>

                                    <AnimatePresence>
                                        {showAiMenu && (
                                            <motion.div
                                                className="chat-ai-menu glass"
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                            >
                                                <button onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    ✨ Make shorter
                                                </button>
                                                <button onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    📝 Make clearer
                                                </button>
                                                <button onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    👔 Make formal
                                                </button>
                                                <button onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    😊 Make casual
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        <button className="chat-input-btn" aria-label="Emoji">
                            <Smile size={20} />
                        </button>

                        {message.trim() ? (
                            <button
                                className="chat-input-send"
                                onClick={handleSend}
                                aria-label="Send message"
                            >
                                <Send size={18} />
                            </button>
                        ) : (
                            <button className="chat-input-btn" aria-label="Voice message">
                                <Mic size={20} />
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
