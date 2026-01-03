import { create } from 'zustand';
import type { ConversationWithMembers, MessageWithDetails, MessageStatus, Reaction, ReactionUpdatedPayload } from '@linkup/shared';
import { useAuthStore } from './auth';
import { useUIStore } from './ui';
import { wsClient } from '../lib/ws';

interface PendingMessage extends MessageWithDetails {
    status: MessageStatus | 'sending';
}

interface ChatState {
    // Conversations
    conversations: ConversationWithMembers[];
    conversationsLoading: boolean;
    conversationsError: string | null;
    setConversations: (conversations: ConversationWithMembers[]) => void;
    addConversation: (conversation: ConversationWithMembers) => void;
    updateConversation: (id: string, updates: Partial<ConversationWithMembers>) => void;
    removeConversation: (id: string) => void;

    // Messages by conversation ID
    messages: Record<string, MessageWithDetails[]>;
    messagesLoading: Record<string, boolean>;
    hasMoreMessages: Record<string, boolean>;
    setMessages: (conversationId: string, messages: MessageWithDetails[]) => void;
    addMessage: (conversationId: string, message: MessageWithDetails) => void;
    updateMessage: (conversationId: string, messageId: string, updates: Partial<MessageWithDetails>) => void;
    removeMessage: (conversationId: string, messageId: string) => void;
    prependMessages: (conversationId: string, messages: MessageWithDetails[], hasMore: boolean) => void;

    // Pending messages (optimistic UI)
    pendingMessages: Record<string, PendingMessage[]>;
    addPendingMessage: (conversationId: string, message: PendingMessage) => void;
    updatePendingMessage: (conversationId: string, messageId: string, status: MessageStatus) => void;
    removePendingMessage: (conversationId: string, messageId: string) => void;

    // Message status tracking (Phase 4: Trust & Delivery)
    messageStatus: Record<string, Record<string, MessageStatus>>; // conversationId -> messageId -> status
    messageTimeouts: Map<string, ReturnType<typeof setTimeout>>; // messageId -> timeout
    handleMessageTimeout: (messageId: string, conversationId: string) => void;

    // Typing indicators
    typingUsers: Record<string, string[]>; // conversationId -> userIds
    setTypingUser: (conversationId: string, userId: string, isTyping: boolean) => void;

    // Read receipts
    readReceipts: Record<string, Record<string, string>>; // conversationId -> { userId -> lastReadMessageId }
    setReadReceipt: (conversationId: string, userId: string, messageId: string) => void;

    // Delivery receipts
    deliveryReceipts: Record<string, Set<string>>; // messageId -> Set of userIds who received it
    setDeliveryReceipt: (messageId: string, userId: string) => void;

    // Seen receipts (read receipts)
    seenReceipts: Record<string, Set<string>>; // messageId -> Set of userIds who have seen it
    setSeenReceipt: (messageId: string, userId: string) => void;

    // Reactions
    reactions: Record<string, Reaction[]>; // messageId -> Reaction[]
    toggleReaction: (messageId: string, emoji: string) => void;
    handleReactionUpdated: (payload: ReactionUpdatedPayload) => void;

    // Actions
    fetchConversations: () => Promise<void>;
    fetchMessages: (conversationId: string, before?: string) => Promise<void>;
    sendMessage: (conversationId: string, content: string, type?: 'text' | 'image' | 'video' | 'voice') => void;
    retryMessage: (conversationId: string, messageId: string) => void;
    handleMessageAck: (payload: import('@linkup/shared').MessageAckPayload) => void;
    handleNewMessage: (message: MessageWithDetails) => void;
    handleDeliveryReceipt: (payload: import('@linkup/shared').ReadReceiptPayload) => void;
    handleReadReceipt: (payload: import('@linkup/shared').ReadReceiptPayload) => void;
    handleMessageUpdated: (payload: import('@linkup/shared').MessageUpdatedPayload) => void;
    handleMessageDeleted: (payload: import('@linkup/shared').MessageDeletedPayload) => void;

    // Phase 9.5: Mark as read action
    markConversationAsRead: (conversationId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
    // Conversations
    conversations: [],
    conversationsLoading: true,
    conversationsError: null,
    setConversations: (conversations) => set({ conversations, conversationsLoading: false, conversationsError: null }),
    addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations],
    })),
    updateConversation: (id, updates) => set((state) => ({
        conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c
        ),
    })),
    // Phase 9.5: Mark as read implementation (Optimistic)
    markConversationAsRead: async (conversationId: string) => {
        // Optimistic update: clear unread immediately
        set((state) => ({
            conversations: state.conversations.map((c) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
            ),
        }));

        try {
            await import('../lib/api').then(({ api }) => api.markConversationAsRead(conversationId));
        } catch (error) {
            console.error('Failed to mark conversation as read', error);
            // We could revert here, but for read status it's better to stay cleared
            // and let the next refetch sync it if it failed.
        }
    },
    removeConversation: (id) => set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
    })),

    // Messages
    messages: {},
    messagesLoading: {},
    hasMoreMessages: {},
    setMessages: (conversationId, messages) => set((state) => ({
        messages: { ...state.messages, [conversationId]: messages },
        messagesLoading: { ...state.messagesLoading, [conversationId]: false },
    })),
    addMessage: (conversationId, message) => set((state) => {
        const existing = state.messages[conversationId] || [];
        // Check for duplicates
        if (existing.some((m) => m.id === message.id)) {
            return state;
        }
        return {
            messages: {
                ...state.messages,
                [conversationId]: [...existing, message],
            },
        };
    }),
    updateMessage: (conversationId, messageId, updates) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
            ),
        },
    })),
    removeMessage: (conversationId, messageId) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).filter(
                (m) => m.id !== messageId
            ),
        },
    })),
    prependMessages: (conversationId, messages, hasMore) => set((state) => ({
        messages: {
            ...state.messages,
            [conversationId]: [...messages, ...(state.messages[conversationId] || [])],
        },
        hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: hasMore },
        messagesLoading: { ...state.messagesLoading, [conversationId]: false },
    })),

    // Pending messages
    pendingMessages: {},

    // PHASE 6: messageStatus kept for interface compatibility but no longer used
    // Status is now derived from message.deliveredAt/readAt
    messageStatus: {},
    messageTimeouts: new Map(),

    addPendingMessage: (conversationId, message) => set((state) => ({
        pendingMessages: {
            ...state.pendingMessages,
            [conversationId]: [...(state.pendingMessages[conversationId] || []), message],
        },
    })),
    updatePendingMessage: (conversationId, messageId, status) => set((state) => ({
        pendingMessages: {
            ...state.pendingMessages,
            [conversationId]: (state.pendingMessages[conversationId] || []).map((m) =>
                m.id === messageId ? { ...m, status } : m
            ),
        },
    })),
    removePendingMessage: (conversationId, messageId) => set((state) => ({
        pendingMessages: {
            ...state.pendingMessages,
            [conversationId]: (state.pendingMessages[conversationId] || []).filter(
                (m) => m.id !== messageId
            ),
        },
    })),

    // Typing indicators
    typingUsers: {},
    setTypingUser: (conversationId, userId, isTyping) => set((state) => {
        const current = state.typingUsers[conversationId] || [];
        const updated = isTyping
            ? [...new Set([...current, userId])]
            : current.filter((id) => id !== userId);
        return {
            typingUsers: { ...state.typingUsers, [conversationId]: updated },
        };
    }),

    // Read receipts
    readReceipts: {},
    setReadReceipt: (conversationId, userId, messageId) => set((state) => ({
        readReceipts: {
            ...state.readReceipts,
            [conversationId]: {
                ...(state.readReceipts[conversationId] || {}),
                [userId]: messageId,
            },
        },
    })),

    // Delivery receipts
    deliveryReceipts: {},
    setDeliveryReceipt: (messageId, userId) => set((state) => {
        const current = state.deliveryReceipts[messageId] || new Set();
        const updated = new Set(current);
        updated.add(userId);
        return {
            deliveryReceipts: { ...state.deliveryReceipts, [messageId]: updated },
        };
    }),

    // Seen receipts
    seenReceipts: {},
    setSeenReceipt: (messageId, userId) => set((state) => {
        const current = state.seenReceipts[messageId] || new Set();
        const updated = new Set(current);
        updated.add(userId);
        return {
            seenReceipts: { ...state.seenReceipts, [messageId]: updated },
        };
    }),

    // Reactions
    reactions: {},
    toggleReaction: (messageId, emoji) => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const current = get().reactions[messageId] || [];
        const existing = current.find(r => r.userId === user.id && r.emoji === emoji);

        if (existing) {
            // Remove reaction optimistically
            set((state) => ({
                reactions: {
                    ...state.reactions,
                    [messageId]: current.filter(r => r.id !== existing.id)
                }
            }));
            wsClient.react(messageId, null);
        } else {
            // Add reaction optimistically
            const newReaction: Reaction = {
                id: crypto.randomUUID(),
                messageId,
                userId: user.id,
                emoji,
                createdAt: new Date().toISOString()
            };
            set((state) => ({
                reactions: {
                    ...state.reactions,
                    [messageId]: [...current, newReaction]
                }
            }));
            wsClient.react(messageId, emoji);
        }
    },
    handleReactionUpdated: (payload) => {
        const { messageId, userId, emoji } = payload;
        const current = get().reactions[messageId] || [];

        if (emoji === null) {
            // Remove reaction
            set((state) => ({
                reactions: {
                    ...state.reactions,
                    [messageId]: current.filter(r => r.userId !== userId)
                }
            }));
        } else {
            // Add or update reaction
            const existing = current.find(r => r.userId === userId);
            if (existing) {
                // Update existing
                set((state) => ({
                    reactions: {
                        ...state.reactions,
                        [messageId]: current.map(r =>
                            r.userId === userId ? { ...r, emoji } : r
                        )
                    }
                }));
            } else {
                // Add new
                const newReaction: Reaction = {
                    id: crypto.randomUUID(),
                    messageId,
                    userId,
                    emoji,
                    createdAt: new Date().toISOString()
                };
                set((state) => ({
                    reactions: {
                        ...state.reactions,
                        [messageId]: [...current, newReaction]
                    }
                }));
            }
        }
    },

    // Actions
    fetchConversations: async () => {
        // PERMIT RE-FETCHING: Do not return early if loading=false
        // logic: strict backend source of truth means we must query if asked.

        try {
            const { api } = await import('../lib/api');
            const response = await api.getConversations();
            set({ conversations: response.conversations, conversationsLoading: false });
        } catch (error) {
            console.error('Failed to fetch conversations', error);
            // Even on error, ensure loading is false so UI doesn't hang
            set({ conversationsLoading: false, conversationsError: 'Failed to load conversations' });
        }
    },

    fetchMessages: async (conversationId: string, before?: string) => {
        const { messagesLoading, hasMoreMessages } = get();
        if (messagesLoading[conversationId] || (before && hasMoreMessages[conversationId] === false)) return;

        set((state) => ({
            messagesLoading: { ...state.messagesLoading, [conversationId]: true },
        }));

        try {
            const { api } = await import('../lib/api');
            const response = await api.getMessages(conversationId, before);

            // API returns messages in DESC order (newest first)
            // We store them in ASC order (oldest first) for easier rendering
            const messagesAsc = [...response.messages].reverse();

            set((state) => {
                const current = state.messages[conversationId] || [];
                // If fetching older (with before), prepend older messages.
                // If initial load (no before), replace.
                const newMessages = before
                    ? [...messagesAsc, ...current]  // Older messages go to the front
                    : messagesAsc;

                return {
                    messages: { ...state.messages, [conversationId]: newMessages },
                    hasMoreMessages: { ...state.hasMoreMessages, [conversationId]: response.hasMore },
                    messagesLoading: { ...state.messagesLoading, [conversationId]: false },
                };
            });

            // PHASE 4.1: Delivery Reconciliation
            // For each message from current user that's in 'sent' state,
            // check if any recipients are online → transition to 'delivered'
            const { user } = useAuthStore.getState();
            if (!user) return;

            const myMessages = messagesAsc.filter(m => m.senderId === user.id);
            const conversation = get().conversations.find(c => c.id === conversationId);

            if (conversation && myMessages.length > 0) {
                // Get online members (check via lastSeenAt - online if seen in last 60s)
                const onlineMembers = conversation.members.filter(m =>
                    m.user.id !== user.id &&
                    m.user.lastSeenAt &&
                    (Date.now() - new Date(m.user.lastSeenAt).getTime()) < 60000
                );

                if (onlineMembers.length > 0) {
                    set((state) => {
                        const updates: Record<string, MessageStatus> = {};

                        myMessages.forEach(msg => {
                            const currentStatus = state.messageStatus[conversationId]?.[msg.id];
                            // Only transition sent → delivered (don't override read/failed)
                            if (currentStatus === 'sent') {
                                updates[msg.id] = 'delivered';
                                console.log('[RECONCILE]', {
                                    messageId: msg.id,
                                    from: 'sent',
                                    to: 'delivered',
                                    reason: 'fetch_reconciliation',
                                    onlineMembers: onlineMembers.length,
                                    timestamp: Date.now()
                                });
                            }
                        });

                        if (Object.keys(updates).length > 0) {
                            return {
                                messageStatus: {
                                    ...state.messageStatus,
                                    [conversationId]: {
                                        ...state.messageStatus[conversationId],
                                        ...updates
                                    }
                                }
                            };
                        }
                        return {};
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages', error);
            set((state) => ({
                messagesLoading: { ...state.messagesLoading, [conversationId]: false },
            }));
        }
    },

    sendMessage: (conversationId: string, content: string, type: 'text' | 'image' | 'video' | 'voice' = 'text') => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const pendingMsg: PendingMessage = {
            id,
            conversationId,
            senderId: user.id,
            content,
            type,
            replyToId: null,
            editedAt: null,
            deletedAt: null,
            deliveredAt: null,  // PHASE 6: Not delivered yet
            readAt: null,        // PHASE 6: Not read yet
            createdAt: timestamp,
            sender: user,
            replyTo: null,
            attachments: [],
            reactions: [],
            status: 'sending',
        };

        // Add to pending
        set((state) => ({
            pendingMessages: {
                ...state.pendingMessages,
                [conversationId]: [...(state.pendingMessages[conversationId] || []), pendingMsg],
            },
            // Initialize message status
            messageStatus: {
                ...state.messageStatus,
                [conversationId]: {
                    ...state.messageStatus[conversationId],
                    [id]: 'pending' as MessageStatus
                }
            }
        }));

        // Start 10s timeout for failure detection
        const timeout = setTimeout(() => {
            get().handleMessageTimeout(id, conversationId);
        }, 10000);
        get().messageTimeouts.set(id, timeout);

        // Send via WS
        wsClient.sendMessage(id, conversationId, content, type);

        console.log('[MSG_STATE]', { messageId: id, from: null, to: 'pending', timestamp: Date.now() });
    },

    retryMessage: (conversationId: string, messageId: string) => {
        const pending = get().pendingMessages[conversationId] || [];
        const failedMessage = pending.find((m) => m.id === messageId);

        if (!failedMessage) return;

        // CRITICAL: Reuse the same messageId, do NOT generate a new one
        // Backend is idempotent (ON CONFLICT DO UPDATE)

        // Update status to pending (sending)
        set((state) => ({
            pendingMessages: {
                ...state.pendingMessages,
                [conversationId]: (state.pendingMessages[conversationId] || []).map((m) =>
                    m.id === messageId ? { ...m, status: 'sending' } : m
                ),
            },
            messageStatus: {
                ...state.messageStatus,
                [conversationId]: {
                    ...state.messageStatus[conversationId],
                    [messageId]: 'pending' as MessageStatus
                }
            }
        }));

        console.log('[MSG_RETRY]', { messageId, conversationId, timestamp: Date.now() });

        // Start new timeout
        const timeout = setTimeout(() => {
            get().handleMessageTimeout(messageId, conversationId);
        }, 10000);
        get().messageTimeouts.set(messageId, timeout);

        // Retry with SAME message ID
        wsClient.sendMessage(
            failedMessage.id,  // ← Same ID, not crypto.randomUUID()
            failedMessage.conversationId,
            failedMessage.content,
            failedMessage.type as 'text' | 'image' | 'video' | 'voice'
        );
    },

    // Timeout handler
    handleMessageTimeout: (messageId: string, conversationId: string) => {
        const currentStatus = get().messageStatus[conversationId]?.[messageId];
        if (currentStatus === 'pending') {
            set((state) => ({
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId]: (state.pendingMessages[conversationId] || []).map((m) =>
                        m.id === messageId ? { ...m, status: 'failed' } : m
                    ),
                },
                messageStatus: {
                    ...state.messageStatus,
                    [conversationId]: {
                        ...state.messageStatus[conversationId],
                        [messageId]: 'failed'
                    }
                }
            }));
            console.log('[MSG_STATE]', { messageId, from: 'pending', to: 'failed', reason: 'timeout', timestamp: Date.now() });
        }
    },

    // WebSocket Event Handlers
    handleMessageAck: (payload: import('@linkup/shared').MessageAckPayload) => {
        const { id, status } = payload;

        // Find which conversation this message belongs to (search pending)
        const { pendingMessages, messageTimeouts } = get();
        let conversationId: string | undefined;

        for (const [cid, msgs] of Object.entries(pendingMessages)) {
            if (msgs.some(m => m.id === id)) {
                conversationId = cid;
                break;
            }
        }

        if (!conversationId) return;

        // Clear timeout
        const timeout = messageTimeouts.get(id);
        if (timeout) {
            clearTimeout(timeout);
            messageTimeouts.delete(id);
        }

        if (status === 'error') {
            // Transition pending → failed
            set((state) => ({
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId!]: (state.pendingMessages[conversationId!] || []).map(m =>
                        m.id === id ? { ...m, status: 'failed' } : m
                    ),
                },
                messageStatus: {
                    ...state.messageStatus,
                    [conversationId!]: {
                        ...state.messageStatus[conversationId!],
                        [id]: 'failed'
                    }
                }
            }));
            console.log('[MSG_STATE]', { messageId: id, from: 'pending', to: 'failed', reason: 'server_error', timestamp: Date.now() });
        } else {
            // Transition pending → sent
            set((state) => ({
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId!]: (state.pendingMessages[conversationId!] || []).map(m =>
                        m.id === id ? { ...m, status: 'sent' } : m
                    ),
                },
                messageStatus: {
                    ...state.messageStatus,
                    [conversationId!]: {
                        ...state.messageStatus[conversationId!],
                        [id]: 'sent'
                    }
                }
            }));
            console.log('[MSG_STATE]', { messageId: id, from: 'pending', to: 'sent', timestamp: Date.now() });
        }
    },

    handleNewMessage: (message: MessageWithDetails) => {
        set((state) => {
            const { conversationId } = message;
            const { user } = useAuthStore.getState();

            // 1. Update Messages
            const pending = state.pendingMessages[conversationId] || [];
            const isMyMessage = message.senderId === user?.id || pending.some(m => m.id === message.id);

            const newPending = isMyMessage
                ? pending.filter(m => m.id !== message.id)
                : pending;

            const currentMessages = state.messages[conversationId] || [];
            // Prevent duplicates
            if (currentMessages.some(m => m.id === message.id)) {
                return { pendingMessages: { ...state.pendingMessages, [conversationId]: newPending } };
            }

            const newMessages = [...currentMessages, message];

            // 2. Update Conversation (Sidebar)
            const conversationIndex = state.conversations.findIndex(c => c.id === conversationId);
            let newConversations = [...state.conversations];

            if (conversationIndex !== -1) {
                const conversation = newConversations[conversationIndex];

                // PHASE 9.6: Monotonic Unread Logic
                // If active, unreadCount = 0 (and stay 0).
                // If inactive, unreadCount += 1.
                // Never decrement here (only open triggers decrement -> 0).

                // Check if this conversation is currently open
                // We need to import useUIStore here or use a getter if possible, 
                // but better to access the store directly to avoid circular deps if in same file (it's not).
                // We'll use the imported store.
                const isActive = useUIStore.getState().activeConversationId === conversationId;
                const isUnread = !isMyMessage && !isActive;

                const updatedConversation = {
                    ...conversation,
                    lastMessage: {
                        id: message.id,
                        content: message.content,
                        type: message.type,
                        senderId: message.senderId,
                        createdAt: message.createdAt
                    },
                    updatedAt: message.createdAt,
                    // If active, force to 0. If inactive, increment.
                    unreadCount: isActive ? 0 : (conversation.unreadCount + (isUnread ? 1 : 0))
                };

                // Move to top and update
                newConversations.splice(conversationIndex, 1);
                newConversations.unshift(updatedConversation);
            }

            return {
                messages: {
                    ...state.messages,
                    [conversationId]: newMessages
                },
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId]: newPending
                },
                conversations: newConversations
            };
        });
    },


    // PHASE 5: Legacy handlers removed - Phase 4 handlers with terminal guards are defined below


    handleMessageUpdated: (payload) => set((state) => {
        const { conversationId, id, content, editedAt } = payload;

        // Update messages if loaded
        const messages = state.messages[conversationId];
        const newMessages = messages ? {
            messages: {
                ...state.messages,
                [conversationId]: messages.map(msg =>
                    msg.id === id
                        ? { ...msg, content, editedAt }
                        : msg
                )
            }
        } : {};

        // Update conversation lastMessage
        const conversations = state.conversations.map(c => {
            if (c.id === conversationId && c.lastMessage?.id === id) {
                return {
                    ...c,
                    lastMessage: {
                        ...c.lastMessage!,
                        content,
                        editedAt
                    }
                };
            }
            return c;
        });

        return { ...newMessages, conversations };
    }),

    handleMessageDeleted: (payload) => set((state) => {
        const { conversationId, id } = payload;

        // Update messages if loaded
        const messages = state.messages[conversationId];
        const newMessages = messages ? {
            messages: {
                ...state.messages,
                [conversationId]: messages.map(msg =>
                    msg.id === id
                        ? { ...msg, deletedAt: new Date().toISOString() }
                        : msg
                )
            }
        } : {};

        // Update conversation lastMessage
        const conversations = state.conversations.map(c => {
            if (c.id === conversationId && c.lastMessage?.id === id) {
                return {
                    ...c,
                    lastMessage: {
                        ...c.lastMessage!,
                        deletedAt: new Date().toISOString(),
                        content: 'Message deleted',
                    }
                };
            }
            return c;
        });

        return { ...newMessages, conversations };
    }),
    // PHASE 6: Backend-authoritative delivery receipt handler
    // Simply update the message's deliveredAt from backend payload
    handleDeliveryReceipt: (payload) => {
        const { messageId, conversationId, deliveredAt } = payload;
        if (!deliveredAt) return;

        set((state) => ({
            messages: {
                ...state.messages,
                [conversationId]: (state.messages[conversationId] || []).map(m =>
                    m.id === messageId && !m.deliveredAt ? { ...m, deliveredAt } : m
                )
            }
        }));
        console.log('[PHASE6] Delivery receipt', { messageId, deliveredAt });
    },

    // PHASE 8.6: Backend-authoritative read receipt handler
    // Updates message readAt AND tracks per-user reads for group chats
    handleReadReceipt: (payload) => {
        const { messageId, conversationId, readAt, userId } = payload;
        if (!readAt) return;

        set((state) => {
            // Update message readAt timestamp
            const updatedMessages = {
                ...state.messages,
                [conversationId]: (state.messages[conversationId] || []).map(m =>
                    m.id === messageId && !m.readAt ? { ...m, readAt } : m
                )
            };

            // PHASE 8.6: Track per-user reads for group chats
            const updatedSeenReceipts = { ...state.seenReceipts };
            if (userId) {
                const current = updatedSeenReceipts[messageId] || new Set();
                const updated = new Set(current);
                updated.add(userId);
                updatedSeenReceipts[messageId] = updated;
            }

            return {
                messages: updatedMessages,
                seenReceipts: updatedSeenReceipts
            };
        });
        console.log('[PHASE8.6] Read receipt', { messageId, userId, readAt });
    },
}));

