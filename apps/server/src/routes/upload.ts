import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { GetUploadUrlRequest, GetUploadUrlResponse } from '@linkup/shared';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VOICE_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_VOICE_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg'];

const uploadUrlSchema = z.object({
    filename: z.string().max(255),
    mimeType: z.string(),
    sizeBytes: z.number().positive(),
});

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
    // Auth middleware
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // Get pre-signed upload URL
    fastify.post<{ Body: GetUploadUrlRequest }>('/url', async (request, reply) => {
        const body = uploadUrlSchema.parse(request.body);
        const { filename, mimeType, sizeBytes } = body;

        // Validate file type and size
        let maxSize: number;
        if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
            maxSize = MAX_IMAGE_SIZE;
        } else if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
            maxSize = MAX_VIDEO_SIZE;
        } else if (ALLOWED_VOICE_TYPES.includes(mimeType)) {
            maxSize = MAX_VOICE_SIZE;
        } else {
            return reply.code(400).send({ error: 'Unsupported file type' });
        }

        if (sizeBytes > maxSize) {
            return reply.code(400).send({ error: `File too large. Max size: ${maxSize / 1024 / 1024}MB` });
        }

        // TODO: Implement
        // 1. Generate unique attachment ID
        // 2. Generate S3 pre-signed PUT URL
        // 3. Store pending attachment record in DB
        // 4. Return URL and attachment ID

        const response: GetUploadUrlResponse = {
            uploadUrl: 'https://s3.example.com/presigned-url',
            attachmentId: 'pending-attachment-id',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
        };

        return response;
    });

    // Confirm upload complete
    fastify.post<{ Params: { id: string } }>('/:id/complete', async (request, reply) => {
        const { id } = request.params;

        // TODO: Implement
        // 1. Verify attachment belongs to user
        // 2. Verify file exists in S3
        // 3. Generate thumbnail if image/video
        // 4. Extract duration if video/voice
        // 5. Mark attachment as ready

        return { success: true };
    });
};
