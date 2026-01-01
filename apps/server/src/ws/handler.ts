import type { SocketStream } from '@fastify/websocket';
import type { FastifyRequest, FastifyInstance } from 'fastify';
import type { ClientMessage, ServerMessage, MessageWithDetails, User } from '@linkup/shared';
import { redisSub, redisPub } from '../lib/redis.js';
import { query, queryOne } from '../lib/db.js';

// Connection registry (in-memory, per-instance)
const connections = new Map<string, Set<SocketStream>>();
const userSockets = new Map<string, Set<SocketStream>>(); // userId -> sockets

// JWT payload type
interface JwtPayload {
    id: string;
    email: string;
}

// Subscribe to conversation
function subscribeToConversation(conversationId: string, socket: SocketStream) {
    const key = `conv:${conversationId}`;
    let sockets = connections.get(key);
    if (!sockets) {
        sockets = new Set();
        connections.set(key, sockets);
        redisSub.subscribe(key);
    }
    sockets.add(socket);
}

// Unsubscribe from conversation
function unsubscribeFromConversation(conversationId: string, socket: SocketStream) {
    const key = `conv:${conversationId}`;
    const sockets = connections.get(key);
    if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
            connections.delete(key);
            redisSub.unsubscribe(key);
        }
    }
}

// Broadcast to conversation (via Redis for multi-instance)
async function broadcastToConversation(conversationId: string, message: ServerMessage) {
    await redisPub.publish(`conv:${conversationId}`, JSON.stringify(message));
}

// Handle Redis pub/sub messages
redisSub.on('message', (channel: string, message: string) => {
    const sockets = connections.get(channel);
    if (sockets) {
        sockets.forEach((socket) => {
            if (socket.socket.readyState === 1) {
                socket.socket.send(message);
            }
        });
    }
});

// Send message to single socket
function send(socket: SocketStream, message: ServerMessage) {
    if (socket.socket.readyState === 1) {
        socket.socket.send(JSON.stringify(message));
    }
}

// Track user socket for presence
function trackUserSocket(userId: string, socket: SocketStream) {
    let sockets = userSockets.get(userId);
    if (!sockets) {
        sockets = new Set();
        userSockets.set(userId, sockets);
    }
    sockets.add(socket);
}

// Remove user socket
function removeUserSocket(userId: string, socket: SocketStream) {
    const sockets = userSockets.get(userId);
    if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
            userSockets.delete(userId);
        }
    }
}

// Check if user is online
function isUserOnline(userId: string): boolean {
    const sockets = userSockets.get(userId);
    return sockets !== undefined && sockets.size > 0;
}

// Create WebSocket handler factory (needs fastify instance for JWT)
export function createWebsocketHandler(fastify: FastifyInstance) {
    return async function websocketHandler(socket: SocketStream, request: FastifyRequest) {
        // Authenticate via token query param
        const token = (request.query as Record<string, string>).token;

        if (!token) {
            send(socket, { type: 'error', payload: { code: 'UNAUTHORIZED', message: 'Missing token' } });
            socket.socket.close(4001, 'Unauthorized');
            return;
        }

        // Verify JWT
        let userId: string;
        try {
            const payload = fastify.jwt.verify<JwtPayload>(token);
            userId = payload.id;
        } catch (err) {
            send(socket, { type: 'error', payload: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
            socket.socket.close(4001, 'Invalid token');
            return;
        }

        // Log: socket.connect
        fastify.log.info({ event: 'socket.connect', userId, socketCount: (userSockets.get(userId)?.size || 0) + 1, timestamp: new Date().toISOString() }, 'WebSocket connected');

        // Track user socket for presence
        trackUserSocket(userId, socket);

        // Update last seen
        await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]);

        // Store user's active conversations for cleanup
        const userConversations = new Set<string>();

        // Handle incoming messages
        socket.socket.on('message', async (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString()) as ClientMessage;

                switch (message.type) {
                    case 'ping':
                        send(socket, { type: 'pong' });
                        break;

                    case 'subscribe':
                        for (const convId of message.payload.conversationIds) {
                            // Verify user is member of conversation
                            const isMember = await queryOne<{ id: string }>(
                                'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                                [convId, userId]
                            );
                            if (isMember) {
                                subscribeToConversation(convId, socket);
                                userConversations.add(convId);
                            }
                        }
                        break;

                    case 'unsubscribe':
                        for (const convId of message.payload.conversationIds) {
                            unsubscribeFromConversation(convId, socket);
                            userConversations.delete(convId);
                        }
                        break;

                    case 'send_message': {
                        const { id, conversationId, content, type, replyToId, attachmentIds } = message.payload;
                        const sendStartTime = Date.now();

                        // Log: msg.send.received
                        fastify.log.info({ event: 'msg.send.received', messageId: id, conversationId, userId, type, timestamp: new Date().toISOString() }, 'Message send received');

                        // Verify user is member
                        const isMember = await queryOne<{ id: string }>(
                            'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                            [conversationId, userId]
                        );

                        if (!isMember) {
                            send(socket, {
                                type: 'message_ack',
                                payload: { id, status: 'error', error: 'Not a member of this conversation' },
                            });
                            break;
                        }

                        try {
                            // Insert message (use client-provided ID for idempotency)
                            const insertResult = await query<{ id: string; created_at: string }>(
                                `INSERT INTO messages (id, conversation_id, sender_id, content, type, reply_to_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
                 RETURNING id, created_at`,
                                [id, conversationId, userId, content, type, replyToId || null]
                            );

                            const dbMessage = insertResult[0]!;

                            // Log: msg.send.persisted
                            fastify.log.info({ event: 'msg.send.persisted', messageId: id, conversationId, userId, latencyMs: Date.now() - sendStartTime, timestamp: new Date().toISOString() }, 'Message persisted to DB');

                            // Link attachments if provided
                            if (attachmentIds && attachmentIds.length > 0) {
                                await query(
                                    `UPDATE attachments SET message_id = $1 WHERE id = ANY($2)`,
                                    [id, attachmentIds]
                                );
                            }

                            // Get sender info
                            const sender = await queryOne<User>(
                                'SELECT id, email, display_name as "displayName", avatar_url as "avatarUrl", status, last_seen_at as "lastSeenAt", created_at as "createdAt" FROM users WHERE id = $1',
                                [userId]
                            );

                            // Get attachments
                            const attachments = await query(
                                `SELECT id, message_id as "messageId", type, url, mime_type as "mimeType", size_bytes as "sizeBytes", 
                 duration_ms as "durationMs", thumbnail, width, height, created_at as "createdAt"
                 FROM attachments WHERE message_id = $1`,
                                [id]
                            );

                            // Build full message for broadcast
                            const fullMessage: MessageWithDetails = {
                                id,
                                conversationId,
                                senderId: userId,
                                content,
                                type,
                                replyToId: replyToId || null,
                                editedAt: null,
                                deletedAt: null,
                                deliveredAt: null,  // PHASE 6: Not delivered yet
                                readAt: null,        // PHASE 6: Not read yet
                                createdAt: dbMessage.created_at,
                                sender: sender!,
                                replyTo: null, // TODO: fetch if replyToId provided
                                attachments: attachments as MessageWithDetails['attachments'],
                                reactions: [],
                            };

                            // Send ack to sender
                            send(socket, {
                                type: 'message_ack',
                                payload: { id, status: 'ok', timestamp: dbMessage.created_at },
                            });

                            // Broadcast to conversation
                            await broadcastToConversation(conversationId, {
                                type: 'new_message',
                                payload: fullMessage,
                            });

                            // Log: msg.send.broadcast
                            fastify.log.info({ event: 'msg.send.broadcast', messageId: id, conversationId, userId, timestamp: new Date().toISOString() }, 'Message broadcast via Redis');

                            // PHASE 6: Send delivery receipts with DB persistence
                            // Get conversation type and other members
                            const convInfo = await queryOne<{ type: string }>('SELECT type FROM conversations WHERE id = $1', [conversationId]);

                            if (convInfo && convInfo.type !== 'channel') {
                                // Get other members who are online
                                const otherMembers = await query<{ user_id: string }>('SELECT user_id FROM conversation_members WHERE conversation_id = $1 AND user_id != $2', [conversationId, userId]);

                                // Check if any other member is online
                                const hasOnlineMember = otherMembers.some(m => isUserOnline(m.user_id));

                                if (hasOnlineMember) {
                                    // PHASE 6: Persist delivered_at to DB (authoritative)
                                    const deliveredAt = new Date().toISOString();
                                    await query(
                                        'UPDATE messages SET delivered_at = $1 WHERE id = $2 AND delivered_at IS NULL',
                                        [deliveredAt, id]
                                    );

                                    // Broadcast delivery receipt with timestamp
                                    await broadcastToConversation(conversationId, {
                                        type: 'delivery_receipt',
                                        payload: {
                                            conversationId,
                                            messageId: id,
                                            deliveredAt,  // PHASE 6: Include timestamp
                                        },
                                    });

                                    fastify.log.info({ event: 'msg.delivery.persisted', messageId: id, conversationId, deliveredAt, timestamp: new Date().toISOString() }, 'Delivery persisted to DB');
                                }
                            }
                        } catch (err) {
                            fastify.log.error({ err }, 'Failed to save message');
                            send(socket, {
                                type: 'message_ack',
                                payload: { id, status: 'error', error: 'Failed to save message' },
                            });
                        }
                        break;
                    }

                    case 'edit_message': {
                        const { id, content } = message.payload;

                        // Verify user owns the message
                        const msg = await queryOne<{ conversation_id: string }>(
                            'SELECT conversation_id FROM messages WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL',
                            [id, userId]
                        );

                        if (!msg) {
                            send(socket, {
                                type: 'error',
                                payload: { code: 'FORBIDDEN', message: 'Cannot edit this message' },
                            });
                            break;
                        }

                        await query(
                            'UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2',
                            [content, id]
                        );

                        const editedAt = new Date().toISOString();

                        await broadcastToConversation(msg.conversation_id, {
                            type: 'message_updated',
                            payload: { id, conversationId: msg.conversation_id, content, editedAt },
                        });
                        break;
                    }

                    case 'delete_message': {
                        const { id } = message.payload;

                        // Verify user owns the message
                        const msg = await queryOne<{ conversation_id: string }>(
                            'SELECT conversation_id FROM messages WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL',
                            [id, userId]
                        );

                        if (!msg) {
                            send(socket, {
                                type: 'error',
                                payload: { code: 'FORBIDDEN', message: 'Cannot delete this message' },
                            });
                            break;
                        }

                        // Soft delete
                        await query('UPDATE messages SET deleted_at = NOW() WHERE id = $1', [id]);

                        await broadcastToConversation(msg.conversation_id, {
                            type: 'message_deleted',
                            payload: { id, conversationId: msg.conversation_id },
                        });
                        break;
                    }

                    case 'typing':
                        // Broadcast typing indicator (no persistence)
                        await broadcastToConversation(message.payload.conversationId, {
                            type: 'typing',
                            payload: {
                                conversationId: message.payload.conversationId,
                                userId,
                                isTyping: message.payload.isTyping,
                            },
                        });
                        break;


                    case 'read': {
                        const { conversationId, messageId } = message.payload;
                        const readStartTime = Date.now();

                        // Log: msg.read.received
                        fastify.log.info({ event: 'msg.read.received', messageId, conversationId, userId, timestamp: new Date().toISOString() }, 'Read event received');

                        // PHASE 6: Persist read_at to message (authoritative)
                        const readAt = new Date().toISOString();
                        await query(
                            'UPDATE messages SET read_at = $1 WHERE id = $2 AND read_at IS NULL',
                            [readAt, messageId]
                        );

                        // Update last read message in conversation_members
                        await query(
                            `UPDATE conversation_members SET last_read_msg_id = $1 
               WHERE conversation_id = $2 AND user_id = $3`,
                            [messageId, conversationId, userId]
                        );

                        // Log: msg.read.persisted
                        fastify.log.info({ event: 'msg.read.persisted', messageId, conversationId, userId, readAt, latencyMs: Date.now() - readStartTime, timestamp: new Date().toISOString() }, 'Read state persisted to DB');

                        // PHASE 6: Broadcast read receipt with authoritative timestamp
                        await broadcastToConversation(conversationId, {
                            type: 'read_receipt',
                            payload: { conversationId, userId, messageId, readAt },
                        });

                        // Log: msg.read.broadcast
                        fastify.log.info({ event: 'msg.read.broadcast', messageId, conversationId, userId, readAt, timestamp: new Date().toISOString() }, 'Read receipt broadcast via Redis');
                        break;
                    }

                    case 'react': {
                        const { messageId, emoji } = message.payload;

                        // Get message's conversation
                        const msg = await queryOne<{ conversation_id: string }>(
                            'SELECT conversation_id FROM messages WHERE id = $1',
                            [messageId]
                        );

                        if (!msg) break;

                        if (emoji === null) {
                            // Remove reaction
                            await query(
                                'DELETE FROM reactions WHERE message_id = $1 AND user_id = $2',
                                [messageId, userId]
                            );
                        } else {
                            // Upsert reaction
                            await query(
                                `INSERT INTO reactions (message_id, user_id, emoji)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`,
                                [messageId, userId, emoji]
                            );
                        }

                        await broadcastToConversation(msg.conversation_id, {
                            type: 'reaction_updated',
                            payload: { messageId, conversationId: msg.conversation_id, userId, emoji },
                        });
                        break;
                    }

                    default:
                        fastify.log.warn({ message }, 'Unknown WebSocket message type');
                }
            } catch (err) {
                fastify.log.error({ err }, 'WebSocket message handling error');
                send(socket, {
                    type: 'error',
                    payload: { code: 'INVALID_MESSAGE', message: 'Failed to process message' },
                });
            }
        });

        // Handle disconnect
        socket.socket.on('close', async () => {
            // Log: socket.disconnect
            fastify.log.info({ event: 'socket.disconnect', userId, socketCount: userSockets.get(userId)?.size || 0, timestamp: new Date().toISOString() }, 'WebSocket disconnected');

            // Cleanup subscriptions
            for (const convId of userConversations) {
                unsubscribeFromConversation(convId, socket);
            }

            // Remove from user sockets
            removeUserSocket(userId, socket);

            // Update last seen
            await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [userId]);

            // Broadcast offline status if no more sockets
            if (!isUserOnline(userId)) {
                // Broadcast to all conversations user is in
                const memberships = await query<{ conversation_id: string }>(
                    'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
                    [userId]
                );

                for (const { conversation_id } of memberships) {
                    await broadcastToConversation(conversation_id, {
                        type: 'presence',
                        payload: { userId, status: 'offline', lastSeenAt: new Date().toISOString() },
                    });
                }
            }
        });

        // Handle errors
        socket.socket.on('error', (err: Error) => {
            fastify.log.error({ err, userId }, 'WebSocket error');
        });

        // Broadcast online status
        const memberships = await query<{ conversation_id: string }>(
            'SELECT conversation_id FROM conversation_members WHERE user_id = $1',
            [userId]
        );

        for (const { conversation_id } of memberships) {
            await broadcastToConversation(conversation_id, {
                type: 'presence',
                payload: { userId, status: 'online', lastSeenAt: null },
            });
        }
    };
}
