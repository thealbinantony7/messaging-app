import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { GetMessagesResponse, MessageWithDetails } from '@linkup/shared';
import { query, queryOne } from '../lib/db.js';

const getMessagesSchema = z.object({
    conversationId: z.string().uuid(),
    before: z.string().uuid().optional(),
    limit: z.coerce.number().min(1).max(100).default(50),
});

export const messageRoutes: FastifyPluginAsync = async (fastify) => {
    // Auth middleware
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // Get messages (paginated)
    fastify.get<{ Querystring: { conversationId: string; before?: string; limit?: string } }>(
        '/',
        async (request, reply) => {
            const params = getMessagesSchema.parse(request.query);
            const { conversationId, before, limit } = params;
            const payload = request.user as { id: string };

            // 1. Verify user is member of conversation
            const isMember = await queryOne(
                'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, payload.id]
            );

            if (!isMember) {
                return reply.code(403).send({ error: 'Forbidden' });
            }

            // 2. Query messages with pagination
            let queryText = `
                SELECT 
                    m.id, m.conversation_id as "conversationId", m.sender_id as "senderId",
                    m.content, m.type, m.reply_to_id as "replyToId",
                    m.edited_at as "editedAt", m.deleted_at as "deletedAt", 
                    m.delivered_at as "deliveredAt", m.read_at as "readAt",
                    m.created_at as "createdAt",
                    u.id as "user_id", u.email, u.display_name, u.avatar_url, u.status, u.last_seen_at, u.created_at as "user_created_at"
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = $1
            `;
            const queryParams: unknown[] = [conversationId];

            if (before) {
                // Get created_at of the 'before' message
                const beforeMsg = await queryOne<{ created_at: string }>(
                    'SELECT created_at FROM messages WHERE id = $1',
                    [before]
                );

                if (beforeMsg) {
                    queryText += ` AND m.created_at < $2`;
                    queryParams.push(beforeMsg.created_at);
                } else {
                    // Fallback to time based on ID if we can't find it (or just fail? Let's assume ID exists if provided)
                    // actually better to just params.push(before) if we used cursor based on ID, but we usually use timestamp for reliable pagination
                }
            }

            queryText += ` ORDER BY m.created_at DESC LIMIT $${queryParams.length + 1}`;
            queryParams.push(limit);

            const rows = await query<any>(queryText, queryParams);
            const messages = rows.map(row => ({
                id: row.id,
                conversationId: row.conversationId,
                senderId: row.senderId,
                content: row.content,
                type: row.type,
                replyToId: row.replyToId,
                editedAt: row.editedAt,
                deletedAt: row.deletedAt,
                deliveredAt: row.deliveredAt,  // PHASE 6: Backend-authoritative
                readAt: row.readAt,              // PHASE 6: Backend-authoritative
                createdAt: row.createdAt,
                sender: {
                    id: row.user_id,
                    email: row.email,
                    displayName: row.display_name,
                    avatarUrl: row.avatar_url,
                    status: row.status,
                    lastSeenAt: row.last_seen_at,
                    createdAt: row.user_created_at
                },
                attachments: [], // TODO: fetch attachments
                reactions: [],   // TODO: fetch reactions
                replyTo: null    // TODO: fetch reply
            }));

            // TODO: Optimize by fetching attachments/reactions in bulk
            // For now, basic retrieval

            // Reverse to return in chronological order
            // messages.reverse(); 
            // actually typical chat app usage is to prepend, so keep DESC order from query for easier handling in frontend? 
            // Usually we return them DESC so the first item is the most recent. The frontend reverses for display if needed.

            return {
                messages,
                hasMore: messages.length === limit,
            };
        }
    );

    // Send message (HTTP fallback)
    fastify.post<{ Body: { conversationId: string; content: string; type?: 'text' | 'image' | 'video' | 'voice'; attachmentIds?: string[] } }>(
        '/',
        async (request, reply) => {
            const { conversationId, content, type = 'text', attachmentIds } = request.body;
            const userId = (request.user as { id: string }).id;

            // 1. Verify user is member
            const isMember = await queryOne(
                'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (!isMember) {
                return reply.code(403).send({ error: 'Forbidden' });
            }

            // 2. Insert message
            const id = crypto.randomUUID();
            const result = await queryOne<{ id: string; created_at: string }>(
                `INSERT INTO messages (id, conversation_id, sender_id, content, type)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, created_at`,
                [id, conversationId, userId, content, type]
            );

            if (!result) throw new Error('Failed to create message');

            // 3. Link attachments
            if (attachmentIds && attachmentIds.length > 0) {
                await query(
                    `UPDATE attachments SET message_id = $1 WHERE id = ANY($2)`,
                    [id, attachmentIds]
                );
            }

            // 4. Get full message details
            const sender = await queryOne<{ id: string, email: string, display_name: string, avatar_url: string, status: string, last_seen_at: string, created_at: string }>(
                'SELECT id, email, display_name, avatar_url, status, last_seen_at, created_at FROM users WHERE id = $1',
                [userId]
            );

            const message: MessageWithDetails = {
                id: result.id,
                conversationId,
                senderId: userId,
                content,
                type,
                replyToId: null,
                editedAt: null,
                deletedAt: null,
                deliveredAt: null,  // PHASE 6: Not delivered yet
                readAt: null,        // PHASE 6: Not read yet
                createdAt: result.created_at,
                sender: {
                    id: sender!.id,
                    email: sender!.email,
                    displayName: sender!.display_name,
                    avatarUrl: sender!.avatar_url,
                    status: sender!.status,
                    lastSeenAt: sender!.last_seen_at,
                    createdAt: sender!.created_at
                },
                replyTo: null,
                attachments: [], // TODO: fetch attachments
                reactions: [],
            };

            // 5. Broadcast via Redis
            const { redisPub } = await import('../lib/redis.js');
            await redisPub.publish(`conv:${conversationId}`, JSON.stringify({
                type: 'new_message',
                payload: message
            }));

            return reply.code(201).send(message);
        }
    );

    // Get single message
    fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { id } = request.params;

        // TODO: Implement
        // 1. Verify user can access this message
        // 2. Return message with details

        return { message: null };
    });

    // Edit message
    fastify.patch<{ Params: { id: string }; Body: { content: string } }>(
        '/:id',
        async (request, reply) => {
            const { id } = request.params;
            const { content } = request.body;
            const userId = (request.user as { id: string }).id;
            request.log.info({ msg: 'Editing message', id, userId });

            // 1. Get message
            const msg = await queryOne<{ sender_id: string; created_at: string; conversation_id: string; deleted_at: string }>(
                'SELECT sender_id, created_at, conversation_id, deleted_at FROM messages WHERE id = $1',
                [id]
            );

            if (!msg) return reply.code(404).send({ error: 'Message not found' });
            if (msg.sender_id !== userId) return reply.code(403).send({ error: 'You can only edit your own messages' });
            if (msg.deleted_at) return reply.code(400).send({ error: 'Cannot edit updated message' });

            // 2. Check 5-minute limit
            const createdAt = new Date(msg.created_at).getTime();
            if (Date.now() - createdAt > 5 * 60 * 1000) {
                return reply.code(400).send({ error: 'Message cannot be edited after 5 minutes' });
            }

            // 3. Update message
            await query('UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2', [content, id]);
            const editedAt = new Date().toISOString();

            // 4. Broadcast
            const { redisPub } = await import('../lib/redis.js');
            await redisPub.publish(`conv:${msg.conversation_id}`, JSON.stringify({
                type: 'message_updated',
                payload: { id, conversationId: msg.conversation_id, content, editedAt }
            }));

            return { success: true, editedAt };
        }
    );

    // Delete message (soft delete)
    fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { id } = request.params;
        const userId = (request.user as { id: string }).id;
        request.log.info({ msg: 'Deleting message', id, userId });

        // 1. Get message
        const msg = await queryOne<{ sender_id: string; conversation_id: string; deleted_at: string }>(
            'SELECT sender_id, conversation_id, deleted_at FROM messages WHERE id = $1',
            [id]
        );

        if (!msg) return reply.code(404).send({ error: 'Message not found' });
        if (msg.sender_id !== userId) return reply.code(403).send({ error: 'You can only delete your own messages' });
        if (msg.deleted_at) return { success: true };

        // 2. Soft delete
        await query('UPDATE messages SET deleted_at = NOW() WHERE id = $1', [id]);

        // 3. Broadcast
        const { redisPub } = await import('../lib/redis.js');
        await redisPub.publish(`conv:${msg.conversation_id}`, JSON.stringify({
            type: 'message_deleted',
            payload: { id, conversationId: msg.conversation_id }
        }));

        return { success: true };
    });

    // Add reaction
    fastify.post<{ Params: { id: string }; Body: { emoji: string } }>(
        '/:id/reactions',
        async (request, reply) => {
            const { id } = request.params;
            const { emoji } = request.body;

            // TODO: Implement
            // 1. Verify user can access message
            // 2. Upsert reaction (replace if exists)
            // 3. Broadcast via WebSocket

            return { success: true };
        }
    );

    // Remove reaction
    fastify.delete<{ Params: { id: string } }>('/:id/reactions', async (request, reply) => {
        const { id } = request.params;

        // TODO: Implement
        // 1. Delete user's reaction on this message
        // 2. Broadcast via WebSocket

        return { success: true };
    });
};
