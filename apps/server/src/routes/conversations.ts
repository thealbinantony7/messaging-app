import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
    ConversationWithMembers,
    CreateConversationRequest,
    ConversationMember,
    User,
    Message,
} from '@linkup/shared';
import { query, queryOne, transaction } from '../lib/db.js';

const createConversationSchema = z.object({
    type: z.enum(['dm', 'group']),
    emails: z.array(z.string().email()).min(1),
    name: z.string().min(1).max(100).optional(),
});

interface JwtPayload {
    id: string;
    email: string;
}

export const conversationRoutes: FastifyPluginAsync = async (fastify) => {
    // Auth middleware for all routes
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // List user's conversations
    fastify.get('/', async (request, reply) => {
        const payload = request.user as JwtPayload;

        try {
            // Query conversations where user is a member
            // Including last message info
            const conversations = await query<any>(`
                SELECT 
                    c.*,
                    (
                        SELECT json_build_object(
                            'id', m.id,
                            'content', m.content,
                            'type', m.type,
                            'senderId', m.sender_id,
                            'createdAt', m.created_at
                        )
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) as "lastMessage",
                    (
                        SELECT COUNT(*)::int
                        FROM messages m
                        LEFT JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
                        WHERE m.conversation_id = c.id 
                        AND m.sender_id != $1
                        AND (
                            cm.last_read_msg_id IS NULL 
                            OR m.created_at > (SELECT created_at FROM messages WHERE id = cm.last_read_msg_id)
                            OR (
                                m.created_at = (SELECT created_at FROM messages WHERE id = cm.last_read_msg_id)
                                AND m.id > cm.last_read_msg_id
                            )
                        )
                    ) as "unreadCount",
                    false as "isPinned",
                    NULL as "pinnedAt"
                FROM conversations c
                JOIN conversation_members cm ON cm.conversation_id = c.id
                WHERE cm.user_id = $1
                ORDER BY 
                    COALESCE(
                        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1),
                        c.updated_at
                    ) DESC NULLS LAST
            `, [payload.id]);

            // Fetch members for each conversation
            for (const conv of conversations) {
                const members = await query<any>(`
                    SELECT 
                        cm.id, cm.role, cm.joined_at as "joinedAt",
                        u.id as "userId", u.email, u.display_name as "displayName", u.avatar_url as "avatarUrl",
                        u.status, u.last_seen_at as "lastSeenAt",
                        (NOW() - COALESCE(u.last_seen_at, '1970-01-01'::timestamptz)) < INTERVAL '30 seconds' as "isOnline"
                    FROM conversation_members cm
                    JOIN users u ON cm.user_id = u.id
                    WHERE cm.conversation_id = $1
                `, [conv.id]);

                conv.members = members.map(m => ({
                    id: m.id,
                    role: m.role,
                    joinedAt: m.joinedAt,
                    userId: m.userId,
                    user: {
                        id: m.userId,
                        email: m.email,
                        displayName: m.displayName,
                        avatarUrl: m.avatarUrl,
                        status: m.status,
                        lastSeenAt: m.lastSeenAt,
                        isOnline: m.isOnline
                    }
                }));
            }

            return { conversations };
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
            return reply.code(500).send({
                error: 'Failed to load conversations',
                details: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });

    // Get single conversation
    fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
        const { id } = request.params;
        const payload = request.user as JwtPayload;

        // Verify membership
        const membership = await queryOne('SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2', [id, payload.id]);
        if (!membership) {
            return reply.code(403).send({ error: 'Forbidden' });
        }

        const conv = await queryOne<any>('SELECT * FROM conversations WHERE id = $1', [id]);
        if (!conv) {
            return reply.code(404).send({ error: 'Conversation not found' });
        }

        const members = await query<any>(`
            SELECT 
                cm.id, cm.role, cm.joined_at as "joinedAt",
                u.id as "userId", u.email, u.display_name as "displayName", u.avatar_url as "avatarUrl"
            FROM conversation_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.conversation_id = $1
        `, [id]);

        conv.members = members.map(m => ({
            id: m.id,
            role: m.role,
            joinedAt: m.joinedAt,
            userId: m.userId,
            user: {
                id: m.userId,
                email: m.email,
                displayName: m.displayName,
                avatarUrl: m.avatarUrl
            }
        }));

        return { conversation: conv };
    });

    // Unified Create Conversation (DM or Group) by Email
    fastify.post<{ Body: CreateConversationRequest }>('/', async (request, reply) => {
        const body = createConversationSchema.parse(request.body);
        const payload = request.user as JwtPayload;
        const { type, emails, name } = body;

        // 1. Resolve emails to user IDs
        const users = await query<{ id: string; email: string }>('SELECT id, email FROM users WHERE email = ANY($1)', [emails]);

        if (users.length !== emails.length) {
            const foundEmails = users.map(u => u.email);
            const missing = emails.filter(e => !foundEmails.includes(e));
            return reply.code(404).send({ error: `Users not found: ${missing.join(', ')}` });
        }

        const memberIds = [payload.id, ...users.map(u => u.id)];
        // Deduplicate
        const uniqueMemberIds = Array.from(new Set(memberIds));

        // 2. If DM, check if it already exists
        if (type === 'dm' && uniqueMemberIds.length === 2) {
            const existingDm = await queryOne<{ conversation_id: string }>(`
                SELECT conversation_id 
                FROM conversation_members cm1
                JOIN conversations c ON c.id = cm1.conversation_id
                WHERE c.type = 'dm'
                AND cm1.user_id = $1
                AND EXISTS (
                    SELECT 1 FROM conversation_members cm2 
                    WHERE cm2.conversation_id = cm1.conversation_id 
                    AND cm2.user_id = $2
                )
            `, [uniqueMemberIds[0], uniqueMemberIds[1]]);

            if (existingDm) {
                return { conversationId: existingDm.conversation_id };
            }
        }

        // 3. Create conversation
        const conversationId = await transaction(async (client) => {
            const convResult = await client.query(
                'INSERT INTO conversations (type, name) VALUES ($1, $2) RETURNING id',
                [type, type === 'group' ? (name || 'New Group') : null]
            );
            const convId = convResult.rows[0].id;

            // Add members
            for (const userId of uniqueMemberIds) {
                await client.query(
                    'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3)',
                    [convId, userId, userId === payload.id ? 'admin' : 'member']
                );
            }

            return convId;
        });

        return { conversationId };
    });

    // Mark conversation as read
    fastify.post<{ Params: { id: string } }>('/:id/read', async (request, reply) => {
        const { id: conversationId } = request.params;
        const userId = (request.user as JwtPayload).id;

        console.log('[MARK_READ] Request received', { conversationId, userId, timestamp: new Date().toISOString() });

        try {
            // Verify user is member
            const membership = await queryOne(
                'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (!membership) {
                console.log('[MARK_READ] Forbidden - user not a member', { conversationId, userId });
                return reply.code(403).send({ error: 'Forbidden' });
            }

            // Get last message in conversation
            const lastMessage = await queryOne<{ id: string }>(
                'SELECT id FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
                [conversationId]
            );

            if (lastMessage) {
                // Update last_read_msg_id
                await query(
                    `UPDATE conversation_members 
                     SET last_read_msg_id = $1 
                     WHERE conversation_id = $2 AND user_id = $3`,
                    [lastMessage.id, conversationId, userId]
                );
                console.log('[MARK_READ] Success', { conversationId, userId, lastMessageId: lastMessage.id });
            } else {
                console.log('[MARK_READ] No messages in conversation', { conversationId });
            }

            return { success: true };
        } catch (error) {
            console.error('[MARK_READ] Error', { conversationId, userId, error });
            return reply.code(500).send({ error: 'Failed to mark as read' });
        }
    });
};
