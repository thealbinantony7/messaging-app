import { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowLeft, MoreVertical, Search, Image, Mic, Send, Smile, Sparkles, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MessageWithDetails } from '@linkup/shared';
import { useUIStore } from '../../stores/ui';
import { useChatStore } from '../../stores/chat';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../lib/api';
import { wsClient } from '../../lib/ws';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import './ChatView.css';

interface Props {
    conversationId: string;
}

export function ChatView({ conversationId }: Props) {
    const [message, setMessage] = useState('');
    const [showAiMenu, setShowAiMenu] = useState(false);
    const [uploadingImage, setUploadingImage] = useState<{
        preview: string;
        progress: number;
    } | null>(null);
    // PHASE 6.3: Invite creation loading state
    const [isCreatingInvite, setIsCreatingInvite] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const stopTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { setActiveConversation, isMobile, addToast } = useUIStore();
    const { user } = useAuthStore();

    // Use separate selectors for better reactivity
    const conversationMessages = useChatStore((state) => state.messages[conversationId] || []);
    const pending = useChatStore((state) => state.pendingMessages[conversationId] || []);
    // PHASE 6: No more messageStatus map - status derived from message fields
    const isLoading = useChatStore((state) => state.messagesLoading[conversationId]);
    const conversation = useChatStore((state) => state.conversations.find((c) => c.id === conversationId));

    // Get actions (these are stable references)
    const fetchMessages = useChatStore((state) => state.fetchMessages);
    const sendMessage = useChatStore((state) => state.sendMessage);
    const retryMessage = useChatStore((state) => state.retryMessage);

    // Offline detection
    const [isOnline, setIsOnline] = useState(wsClient.isConnected);

    useEffect(() => {
        const checkConnection = setInterval(() => {
            setIsOnline(wsClient.isConnected);
        }, 1000);
        return () => clearInterval(checkConnection);
    }, []);

    // PHASE 6: Derive status directly from message fields (backend-authoritative)
    const getMessageStatus = (message: MessageWithDetails): 'sent' | 'delivered' | 'read' => {
        // Skip channels - no delivery receipts for channels
        if (conversation?.type === 'channel') return 'sent';

        // PHASE 6: Backend is the ONLY source of truth
        // Status is derived from message.deliveredAt/readAt timestamps
        if (message.readAt) return 'read';
        if (message.deliveredAt) return 'delivered';
        return 'sent';
    };

    // Fetch messages on mount or id change
    useEffect(() => {
        fetchMessages(conversationId);
    }, [conversationId, fetchMessages]);

    // PHASE 4.1: Subscribe to conversation on mount
    useEffect(() => {
        import('../../lib/ws').then(({ wsClient }) => {
            console.log('[WS_SUBSCRIBE] Subscribing to conversation', { conversationId, timestamp: Date.now() });
            wsClient.subscribe([conversationId]);
        });

        return () => {
            import('../../lib/ws').then(({ wsClient }) => {
                console.log('[WS_UNSUBSCRIBE] Unsubscribing from conversation', { conversationId, timestamp: Date.now() });
                wsClient.unsubscribe([conversationId]);
            });
        };
    }, [conversationId]);

    // Scroll to bottom - instant on conversation change, smooth for new messages
    const prevConversationId = useRef(conversationId);
    const prevMessageCount = useRef(0);

    useEffect(() => {
        const totalMessages = conversationMessages.length + pending.length;

        // Instant scroll always for stability
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        console.log('[ChatView] Scroll adjusted', { totalMessages });

        prevConversationId.current = conversationId;
        prevMessageCount.current = totalMessages;
    }, [conversationMessages.length, pending.length, conversationId]);


    // PHASE 6.3: Simple read receipt - emit when conversation is open
    // Backend is authoritative and handles all validation
    // No visibility hacks, no touch tracking, no scroll detection
    useEffect(() => {
        if (!conversationMessages.length || !user) return;

        // Get the last message in the conversation (regardless of sender)
        const lastMessage = conversationMessages[conversationMessages.length - 1];

        // PHASE 6.3: Simplified - just mark the last message
        // Backend will validate:
        // - Is user a member?
        // - Is message from someone else?
        // - Is message delivered?
        // - Is message already read?
        if (lastMessage) {
            console.log('[PHASE6.3] Marking conversation as read', {
                conversationId,
                messageId: lastMessage.id,
            });
            wsClient.markRead(conversationId, lastMessage.id);

            // Clear unread count immediately (optimistic)
            useChatStore.getState().updateConversation(conversationId, { unreadCount: 0 });
        }
    }, [conversationMessages, conversationId, user]);


    // PHASE 6.1: Dev-mode invariant checks - catch impossible states
    useEffect(() => {
        if (import.meta.env.MODE === 'production') return;

        // Invariant 1: Sidebar shows lastMessage but conversation is empty
        if (conversation?.lastMessage && !conversation.lastMessage.deletedAt &&
            conversationMessages.length === 0 && !isLoading) {
            console.error('[INVARIANT VIOLATION] Sidebar has lastMessage but conversation is empty', {
                conversationId,
                lastMessage: conversation.lastMessage,
                messagesCount: conversationMessages.length,
                isLoading
            });
        }

        // Invariant 2-4: Invalid timestamp ordering in messages
        conversationMessages.forEach(msg => {
            if (msg.readAt && !msg.deliveredAt) {
                console.error('[INVARIANT VIOLATION] Message has readAt but no deliveredAt', {
                    messageId: msg.id,
                    readAt: msg.readAt,
                    deliveredAt: msg.deliveredAt
                });
            }
            if (msg.deliveredAt && new Date(msg.deliveredAt) < new Date(msg.createdAt)) {
                console.error('[INVARIANT VIOLATION] delivered_at < created_at', {
                    messageId: msg.id,
                    createdAt: msg.createdAt,
                    deliveredAt: msg.deliveredAt
                });
            }
            if (msg.readAt && msg.deliveredAt && new Date(msg.readAt) < new Date(msg.deliveredAt)) {
                console.error('[INVARIANT VIOLATION] read_at < delivered_at', {
                    messageId: msg.id,
                    deliveredAt: msg.deliveredAt,
                    readAt: msg.readAt
                });
            }
        });
    }, [conversation, conversationMessages, isLoading, conversationId]);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [message]);

    // specific fix for mobile keyboard obscuring view
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            // If keyboard opens (height shrinks), scroll to bottom
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        };

        window.visualViewport.addEventListener('resize', handleResize);
        return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }, []);

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
        if (!message.trim() || !isOnline) return; // Block send when offline

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

    // PHASE 6.3: Robust invite creation handler
    const handleCreateInvite = async () => {
        if (isCreatingInvite) return;

        setIsCreatingInvite(true);
        try {
            const result = await api.createInviteLink(conversationId);
            await navigator.clipboard.writeText(result.inviteUrl);
            addToast({ type: 'success', message: 'Invite link copied to clipboard!' });
        } catch (err: any) {
            console.error('Invite creation failed:', err);
            // Show explicit error from backend if available
            const errorMessage = err.response?.data?.error || err.message || 'Failed to create invite link';
            addToast({ type: 'error', message: errorMessage });
        } finally {
            setIsCreatingInvite(false);
        }
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
        // PHASE 6.2: Use backend-computed isOnline, NOT client heuristics
        const isOtherOnline = other?.user.isOnline ?? false;
        return {
            name: other?.user.displayName || 'Unknown',
            avatar: other?.user.avatarUrl,
            status: isOtherOnline ? 'Online' : 'Offline',
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
            <header className="chat-header h-16 px-6 border-b border-border/40 bg-background/95 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10 w-full">
                <div className="chat-header-left gap-4">
                    {isMobile && (
                        <button
                            className="chat-header-back hover:bg-white/5 rounded-full w-10 h-10"
                            onClick={() => setActiveConversation(null)}
                            aria-label="Back to conversations"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div className="chat-header-avatar relative w-10 h-10">
                        {displayInfo.avatar ? (
                            <img src={displayInfo.avatar} alt={displayInfo.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <div className="flex items-center justify-center w-full h-full rounded-full bg-secondary text-secondary-foreground font-medium text-sm">
                                {displayInfo.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="chat-header-info flex flex-col justify-center">
                        <h2 className="text-sm font-semibold text-foreground leading-none mb-1">{displayInfo.name}</h2>
                        <span className="text-xs text-muted-foreground font-normal leading-none">{displayInfo.status}</span>
                    </div>
                </div>
                <div className="chat-header-actions gap-2">
                    <button
                        className={`p-2 rounded-full hover:bg-accent text-zinc-400 hover:text-foreground transition-colors ${isCreatingInvite ? 'opacity-50 cursor-not-allowed' : ''}`}
                        aria-label={isCreatingInvite ? "Creating invite..." : "Copy invite link"}
                        onClick={handleCreateInvite}
                        disabled={isCreatingInvite}
                    >
                        {isCreatingInvite ? (
                            <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Link size={20} className="w-5 h-5" />
                        )}
                    </button>
                    <button className="p-2 rounded-full hover:bg-accent text-zinc-400 hover:text-foreground transition-colors" aria-label="Search">
                        <Search size={20} className="w-5 h-5" />
                    </button>
                    <button className="p-2 rounded-full hover:bg-accent text-zinc-400 hover:text-foreground transition-colors" aria-label="More options">
                        <MoreVertical size={20} className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <div className="chat-messages bg-transparent">
                {isLoading ? (
                    <div className="chat-messages-loading">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className={`message-skeleton ${i % 2 === 0 ? 'sent' : 'received'}`}>
                                <div className="skeleton" style={{ width: '60%', height: 40 }} />
                            </div>
                        ))}
                    </div>
                ) : (() => {
                    // PHASE 6.1: Proper empty state check - only show if truly empty
                    // Never show "No messages yet" if sidebar shows lastMessage
                    const shouldShowEmpty = !isLoading &&
                        conversationMessages.length === 0 &&
                        pending.length === 0 &&
                        (!conversation?.lastMessage || !!conversation.lastMessage.deletedAt);

                    return shouldShowEmpty ? (
                        <div className="chat-messages-empty">
                            <p className="text-zinc-500 text-sm">No messages yet. Say hello! 👋</p>
                        </div>
                    ) : null;
                })() || (
                    <div className="chat-messages-list !gap-1 px-4 py-6">
                        {conversationMessages.map((msg, index) => {
                            const prevMsg = index > 0 ? conversationMessages[index - 1] : null;
                            const isGrouped = !!(prevMsg && prevMsg.senderId === msg.senderId &&
                                (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) < 60000); // 1 minute

                            return (
                                <MessageBubble
                                    key={msg.id}
                                    message={msg}
                                    isOwn={msg.senderId === user?.id}
                                    status={msg.senderId === user?.id ? getMessageStatus(msg) : undefined}
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
                        {uploadingImage && (
                            <div className="message-bubble own" style={{ position: 'relative' }}>
                                <div className="message-content">
                                    <div className="message-image" style={{ position: 'relative', maxWidth: '300px' }}>
                                        <img
                                            src={uploadingImage.preview}
                                            alt="Uploading..."
                                            style={{ width: '100%', display: 'block', borderRadius: '12px', opacity: 0.7 }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            background: 'rgba(0,0,0,0.75)',
                                            padding: '12px 20px',
                                            borderRadius: '8px',
                                            color: '#fff',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            whiteSpace: 'nowrap',
                                            backdropFilter: 'blur(4px)'
                                        }}>
                                            Uploading {uploadingImage.progress}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <TypingIndicator conversationId={conversationId} />
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="chat-input border-t border-border/40 bg-background p-4">
                {!canSendMessages ? (
                    <div className="chat-input-readonly">
                        <p>Only admins can send messages in this channel</p>
                    </div>
                ) : (
                    <>
                        <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="image-upload"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                // Create local preview
                                const preview = URL.createObjectURL(file);
                                setUploadingImage({ preview, progress: 0 });

                                try {
                                    const { url } = await api.uploadImage(file, (percent) => {
                                        setUploadingImage((prev) => prev ? { ...prev, progress: percent } : null);
                                    });

                                    // Upload complete → send message
                                    sendMessage(conversationId, url, 'image');

                                    // Cleanup
                                    URL.revokeObjectURL(preview);
                                    setUploadingImage(null);
                                    e.target.value = '';
                                } catch (error) {
                                    console.error('Image upload failed:', error);
                                    addToast({ type: 'error', message: 'Failed to upload image. Please try again.' });
                                    URL.revokeObjectURL(preview);
                                    setUploadingImage(null);
                                    e.target.value = '';
                                }
                            }}
                        />
                        <button
                            className="p-2 rounded-full hover:bg-accent text-zinc-400 hover:text-foreground transition-colors"
                            aria-label="Send image"
                            onClick={() => document.getElementById('image-upload')?.click()}
                        >
                            <Image size={22} strokeWidth={1.5} />
                        </button>

                        <div className="chat-input-wrapper flex-1 relative mx-2">
                            <textarea
                                ref={inputRef}
                                className="w-full bg-secondary/30 border border-transparent focus:border-border/60 rounded-[1.25rem] text-[15px] text-foreground placeholder:text-muted-foreground px-4 py-3 min-h-[44px] max-h-[120px] resize-none focus:outline-none transition-all"
                                placeholder="Message"
                                value={message}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                rows={1}
                            />

                            {/* AI rewrite button */}
                            {message.trim() && (
                                <div className="absolute right-2 bottom-2">
                                    <button
                                        className="p-1.5 rounded-full hover:bg-background/80 text-accent transition-colors"
                                        onClick={() => setShowAiMenu(!showAiMenu)}
                                        aria-label="AI rewrite"
                                    >
                                        <Sparkles size={16} />
                                    </button>

                                    <AnimatePresence>
                                        {showAiMenu && (
                                            <motion.div
                                                className="absolute bottom-full right-0 mb-2 bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[160px] z-50 overflow-hidden"
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                transition={{ duration: 0.15 }}
                                            >
                                                <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md" onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    ✨ Make shorter
                                                </button>
                                                <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md" onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    📝 Make clearer
                                                </button>
                                                <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md" onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    👔 Make formal
                                                </button>
                                                <button className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-md" onClick={() => addToast({ type: 'info', message: 'AI rewrite not implemented' })}>
                                                    😊 Make casual
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>

                        <button className="p-2 rounded-full hover:bg-accent text-zinc-400 hover:text-foreground transition-colors" aria-label="Emoji">
                            <Smile size={22} strokeWidth={1.5} />
                        </button>

                        {message.trim() ? (
                            <button
                                className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleSend}
                                disabled={!isOnline}
                                aria-label="Send message"
                            >
                                <Send size={20} strokeWidth={2} className="ml-0.5" />
                            </button>
                        ) : (
                            <button className="p-2 rounded-full hover:bg-accent text-zinc-400 hover:text-foreground transition-colors" aria-label="Voice message">
                                <Mic size={22} strokeWidth={1.5} />
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
