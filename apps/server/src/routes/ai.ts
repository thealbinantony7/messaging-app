import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type {
    RewriteRequest,
    RewriteResponse,
    SuggestRepliesRequest,
    SuggestRepliesResponse,
    SummarizeRequest,
    SummarizeResponse,
    TranscribeRequest,
    TranscribeResponse,
} from '@linkup/shared';
import { redis } from '../lib/redis.js';
import { env } from '../config/env.js';

const rewriteSchema = z.object({
    text: z.string().min(1).max(4000),
    style: z.enum(['shorter', 'clearer', 'formal', 'casual']),
});

const suggestSchema = z.object({
    conversationId: z.string().uuid(),
    lastMessageCount: z.number().min(1).max(10).default(5),
});

const summarizeSchema = z.object({
    conversationId: z.string().uuid(),
    sinceMessageId: z.string().uuid().optional(),
});

const transcribeSchema = z.object({
    attachmentId: z.string().uuid(),
});

// Rate limiter key
const getRateLimitKey = (userId: string) => `ai:ratelimit:${userId}`;
const getCostKey = (userId: string) => `ai:cost:${userId}:${new Date().toISOString().split('T')[0]}`;

async function checkRateLimit(userId: string): Promise<boolean> {
    const key = getRateLimitKey(userId);
    const count = await redis.incr(key);
    if (count === 1) {
        await redis.expire(key, 3600); // 1 hour
    }
    return count <= env.AI_RATE_LIMIT_PER_HOUR;
}

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
    // Auth middleware
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // Rate limit check hook
    fastify.addHook('preHandler', async (request, reply) => {
        // @ts-expect-error - user is added by JWT verify
        const userId = request.user?.id;
        if (!userId) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const allowed = await checkRateLimit(userId);
        if (!allowed) {
            return reply.code(429).send({
                error: 'AI rate limit exceeded',
                message: 'Please try again later',
            });
        }
    });

    // Rewrite message
    fastify.post<{ Body: RewriteRequest }>('/rewrite', async (request, reply) => {
        const body = rewriteSchema.parse(request.body);

        // TODO: Implement
        // 1. Build prompt based on style
        // 2. Call OpenAI API
        // 3. Track cost
        // 4. Return rewritten text

        const response: RewriteResponse = {
            rewritten: `[${body.style}] ${body.text}`, // Mock
        };

        return response;
    });

    // Smart reply suggestions
    fastify.post<{ Body: SuggestRepliesRequest }>('/suggestions', async (request, reply) => {
        const body = suggestSchema.parse(request.body);

        // TODO: Implement
        // 1. Fetch last N messages from conversation
        // 2. Verify user is member
        // 3. Build context prompt
        // 4. Call OpenAI for suggestions
        // 5. Return max 3 short replies

        const response: SuggestRepliesResponse = {
            suggestions: ['Sounds good!', 'Let me check', '👍'],
        };

        return response;
    });

    // Summarize unread messages
    fastify.post<{ Body: SummarizeRequest }>('/summarize', async (request, reply) => {
        const body = summarizeSchema.parse(request.body);

        // TODO: Implement
        // 1. Fetch messages since sinceMessageId
        // 2. Verify user is member
        // 3. Chunk if too many messages
        // 4. Call OpenAI for summary
        // 5. Return summary (NOT stored)

        const response: SummarizeResponse = {
            summary: 'Mock summary of the conversation...',
            messageCount: 42,
        };

        return response;
    });

    // Transcribe voice note
    fastify.post<{ Body: TranscribeRequest }>('/transcribe', async (request, reply) => {
        const body = transcribeSchema.parse(request.body);

        // TODO: Implement
        // 1. Fetch attachment
        // 2. Verify it's a voice note
        // 3. Verify user can access
        // 4. Download from S3
        // 5. Call Whisper API
        // 6. Optionally save transcript to message.content

        const response: TranscribeResponse = {
            transcript: 'Mock transcription of the voice note...',
        };

        return response;
    });

    // AI health/availability check
    fastify.get('/status', async (request, reply) => {
        const hasApiKey = !!env.OPENAI_API_KEY;
        return {
            available: hasApiKey,
            features: {
                rewrite: hasApiKey,
                suggestions: hasApiKey,
                summarize: hasApiKey,
                transcribe: hasApiKey,
            },
        };
    });
};
