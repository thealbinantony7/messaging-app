import { FastifyInstance } from 'fastify';
import { query } from '../lib/db.js';

interface JwtPayload {
    id: string;
    email: string;
}

interface SearchQuery {
    q: string;
    conversationId: string;
}

export default async function searchRoutes(fastify: FastifyInstance) {
    // Auth middleware
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // PHASE 7.2: Message search (conversation-scoped)
    fastify.get<{ Querystring: SearchQuery }>(
        '/search',
        async (request, reply) => {
            const { q, conversationId } = request.query;
            const userId = (request.user as JwtPayload).id;

            if (!q || !conversationId) {
                return reply.code(400).send({ error: 'Query and conversationId required' });
            }

            // Verify user is member of conversation
            const isMember = await query(
                'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (isMember.length === 0) {
                return reply.code(403).send({ error: 'Not a member of this conversation' });
            }

            // Search messages (case-insensitive, LIMIT 50)
            const results = await query(`
                SELECT 
                    m.id,
                    m.content,
                    m.type,
                    m.created_at as "createdAt",
                    m.sender_id as "senderId",
                    u.display_name as "senderName"
                FROM messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.conversation_id = $1
                  AND m.deleted_at IS NULL
                  AND m.content ILIKE $2
                ORDER BY m.created_at DESC
                LIMIT 50
            `, [conversationId, `%${q}%`]);

            reply.send({ results });
        }
    );
}
