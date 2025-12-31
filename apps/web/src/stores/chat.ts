import { create } from 'zustand';
import type { ConversationWithMembers, MessageWithDetails, MessageStatus, Reaction, ReactionUpdatedPayload } from '@linkup/shared';
import { useAuthStore } from './auth';
import { wsClient } from '../lib/ws';

interface PendingMessage extends MessageWithDetails {
    status: MessageStatus | 'sending';
}

interface ChatState {
    // Conversations
    conversations: ConversationWithMembers[];
    conversationsLoading: boolean;
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
}

export const useChatStore = create<ChatState>((set, get) => ({
    // Conversations
    conversations: [],
    conversationsLoading: true,
    setConversations: (conversations) => set({ conversations, conversationsLoading: false }),
    addConversation: (conversation) => set((state) => ({
        conversations: [conversation, ...state.conversations],
    })),
    updateConversation: (id, updates) => set((state) => ({
        conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, ...updates } : c
        ),
    })),
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
        const { conversationsLoading } = get();
        if (conversationsLoading === false) return; // Already loaded

        try {
            const { api } = await import('../lib/api');
            const response = await api.getConversations();
            set({ conversations: response.conversations, conversationsLoading: false });
        } catch (error) {
            console.error('Failed to fetch conversations', error);
            set({ conversationsLoading: false });
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
        }));

        // Send via WS
        wsClient.sendMessage(id, conversationId, content, type);
    },

    retryMessage: (conversationId: string, messageId: string) => {
        const pending = get().pendingMessages[conversationId] || [];
        const failedMessage = pending.find((m) => m.id === messageId);

        if (!failedMessage) return;

        // Update status to sending
        set((state) => ({
            pendingMessages: {
                ...state.pendingMessages,
                [conversationId]: (state.pendingMessages[conversationId] || []).map((m) =>
                    m.id === messageId ? { ...m, status: 'sending' } : m
                ),
            },
        }));

        // Retry sending via WS with original message ID
        wsClient.sendMessage(
            failedMessage.id,
            failedMessage.conversationId,
            failedMessage.content,
            failedMessage.type as 'text' | 'image' | 'video' | 'voice'
        );
    },

    // WebSocket Event Handlers
    handleMessageAck: (payload: import('@linkup/shared').MessageAckPayload) => {
        const { id, status } = payload;

        // Find which conversation this message belongs to (search pending)
        const { pendingMessages } = get();
        let conversationId: string | undefined;

        for (const [cid, msgs] of Object.entries(pendingMessages)) {
            if (msgs.some(m => m.id === id)) {
                conversationId = cid;
                break;
            }
        }

        if (!conversationId) return;

        if (status === 'error') {
            set((state) => ({
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId!]: (state.pendingMessages[conversationId!] || []).map(m =>
                        m.id === id ? { ...m, status: 'failed' } : m
                    ),
                },
            }));
        } else {
            // Update status to 'sent' in pending
            set((state) => ({
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId!]: (state.pendingMessages[conversationId!] || []).map(m =>
                        m.id === id ? { ...m, status: 'sent' } : m
                    ),
                },
            }));
        }
    },

    handleNewMessage: (message: MessageWithDetails) => {
        set((state) => {
            const { conversationId } = message;

            // Remove from pending if exists (by ID)
            const pending = state.pendingMessages[conversationId] || [];
            const isMyMessage = pending.some(m => m.id === message.id);

            const newPending = isMyMessage
                ? pending.filter(m => m.id !== message.id)
                : pending;

            // Add to messages, ensuring no duplicates
            const currentMessages = state.messages[conversationId] || [];
            if (currentMessages.some(m => m.id === message.id)) {
                return { pendingMessages: { ...state.pendingMessages, [conversationId]: newPending } };
            }

            // Messages are stored in ASC order (oldest first)
            // New messages are appended to the end
            return {
                messages: {
                    ...state.messages,
                    [conversationId]: [...currentMessages, message]
                },
                pendingMessages: {
                    ...state.pendingMessages,
                    [conversationId]: newPending
                }
            };
        });
    },

    handleDeliveryReceipt: (payload: import('@linkup/shared').ReadReceiptPayload) => {
        const { messageId, userId } = payload;
        get().setDeliveryReceipt(messageId, userId);
    },

    handleReadReceipt: (payload: import('@linkup/shared').ReadReceiptPayload) => {
        const { messageId, userId } = payload;
        get().setSeenReceipt(messageId, userId);
    },

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
    })
}));

