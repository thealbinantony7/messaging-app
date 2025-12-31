import { FastifyInstance } from 'fastify';
import { randomBytes } from 'crypto';
import { query, queryOne } from '../lib/db.js';
import type {
    CreateInviteLinkRequest,
    CreateInviteLinkResponse,
    JoinViaInviteRequest,
    JoinViaInviteResponse,
    ConversationWithMembers,
} from '@linkup/shared';

interface JwtPayload {
    id: string;
    email: string;
}

export default async function inviteRoutes(fastify: FastifyInstance) {
    // Auth middleware for all routes
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // Create invite link (admin/owner only)
    fastify.post<{ Body: CreateInviteLinkRequest }>(
        '/invite/create',
        async (request, reply) => {
            const { conversationId } = request.body;
            const userId = (request.user as JwtPayload).id;

            // Verify user is member and has permission (admin for channels, any member for DMs/groups)
            const member = await queryOne<{ role: string; type: string }>(
                `SELECT cm.role, c.type 
                 FROM conversation_members cm
                 JOIN conversations c ON c.id = cm.conversation_id
                 WHERE cm.conversation_id = $1 AND cm.user_id = $2`,
                [conversationId, userId]
            );

            if (!member) {
                return reply.code(403).send({ error: 'Not a member of this conversation' });
            }

            // For channels, only admins can create invite links
            if (member.type === 'channel' && member.role !== 'admin') {
                return reply.code(403).send({ error: 'Only admins can create invite links for channels' });
            }

            // Check if invite link already exists
            const existing = await queryOne<{ token: string }>(
                'SELECT token FROM invite_tokens WHERE conversation_id = $1 LIMIT 1',
                [conversationId]
            );

            if (existing) {
                const inviteUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invite/${existing.token}`;
                return reply.send({
                    token: existing.token,
                    inviteUrl,
                } as CreateInviteLinkResponse);
            }

            // Generate random token
            const token = randomBytes(16).toString('hex');

            // Insert invite token
            await query(
                'INSERT INTO invite_tokens (token, conversation_id, created_by) VALUES ($1, $2, $3)',
                [token, conversationId, userId]
            );

            const inviteUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invite/${token}`;

            reply.send({
                token,
                inviteUrl,
            } as CreateInviteLinkResponse);
        }
    );

    // Join via invite link
    fastify.post<{ Body: JoinViaInviteRequest }>(
        '/invite/join',
        async (request, reply) => {
            const { token } = request.body;
            const userId = (request.user as JwtPayload).id;

            // Resolve token to conversation
            const invite = await queryOne<{ conversation_id: string; type: string }>(
                `SELECT it.conversation_id, c.type
                 FROM invite_tokens it
                 JOIN conversations c ON c.id = it.conversation_id
                 WHERE it.token = $1`,
                [token]
            );

            if (!invite) {
                return reply.code(404).send({ error: 'Invalid invite link' });
            }

            const conversationId = invite.conversation_id;

            // Check if already a member
            const existingMember = await queryOne<{ id: string }>(
                'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (existingMember) {
                // Already a member, just return the conversation
                const conversation = await getConversationWithMembers(conversationId);
                return reply.send({
                    conversationId,
                    conversation,
                } as JoinViaInviteResponse);
            }

            // Add user as member (role depends on conversation type)
            const role = invite.type === 'channel' ? 'member' : 'member';
            await query(
                'INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3)',
                [conversationId, userId, role]
            );

            // Get full conversation details
            const conversation = await getConversationWithMembers(conversationId);

            reply.send({
                conversationId,
                conversation,
            } as JoinViaInviteResponse);
        }
    );

    // Get invite link for conversation (if exists)
    fastify.get<{ Params: { conversationId: string } }>(
        '/invite/:conversationId',
        async (request, reply) => {
            const { conversationId } = request.params;
            const userId = (request.user as JwtPayload).id;

            // Verify user is member
            const member = await queryOne<{ id: string }>(
                'SELECT id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
                [conversationId, userId]
            );

            if (!member) {
                return reply.code(403).send({ error: 'Not a member of this conversation' });
            }

            // Get existing invite token
            const invite = await queryOne<{ token: string }>(
                'SELECT token FROM invite_tokens WHERE conversation_id = $1',
                [conversationId]
            );

            if (!invite) {
                return reply.code(404).send({ error: 'No invite link exists for this conversation' });
            }

            const inviteUrl = `${process.env.APP_URL || 'http://localhost:5173'}/invite/${invite.token}`;

            reply.send({
                token: invite.token,
                inviteUrl,
            } as CreateInviteLinkResponse);
        }
    );
}

// Helper to get conversation with members
async function getConversationWithMembers(conversationId: string): Promise<ConversationWithMembers> {
    const conversation = await queryOne<any>(
        `SELECT id, type, name, avatar_url as "avatarUrl", created_at as "createdAt", updated_at as "updatedAt"
         FROM conversations WHERE id = $1`,
        [conversationId]
    );

    const members = await query<any>(
        `SELECT cm.id, cm.conversation_id as "conversationId", cm.user_id as "userId", cm.role,
                cm.last_read_msg_id as "lastReadMsgId", cm.muted_until as "mutedUntil", cm.joined_at as "joinedAt",
                u.id as "user.id", u.email as "user.email", u.display_name as "user.displayName",
                u.avatar_url as "user.avatarUrl", u.status as "user.status", u.last_seen_at as "user.lastSeenAt"
         FROM conversation_members cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.conversation_id = $1`,
        [conversationId]
    );

    // Transform flat structure to nested
    const transformedMembers = members.map((m: any) => ({
        id: m.id,
        conversationId: m.conversationId,
        userId: m.userId,
        role: m.role,
        lastReadMsgId: m.lastReadMsgId,
        mutedUntil: m.mutedUntil,
        joinedAt: m.joinedAt,
        user: {
            id: m['user.id'],
            email: m['user.email'],
            displayName: m['user.displayName'],
            avatarUrl: m['user.avatarUrl'],
            status: m['user.status'],
            lastSeenAt: m['user.lastSeenAt'],
        },
    }));

    return {
        ...conversation,
        members: transformedMembers,
        unreadCount: 0,
        lastMessage: null,
    };
}
