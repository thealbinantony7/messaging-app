import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { GetUploadUrlRequest, GetUploadUrlResponse } from '@linkup/shared';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
    // Auth middleware
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            reply.code(401).send({ error: 'Unauthorized' });
        }
    });

    // Direct image upload
    fastify.post('/image', async (request, reply) => {
        const data = await request.file();

        if (!data) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }

        // Validate type and size
        if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
            return reply.code(400).send({ error: 'Invalid image type' });
        }

        const buffer = await data.toBuffer();

        if (buffer.length > MAX_IMAGE_SIZE) {
            return reply.code(400).send({ error: 'Image too large (max 10MB)' });
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${data.mimetype.split('/')[1]}`;
        const filePath = `images/${fileName}`;

        const { error } = await supabase.storage
            .from(process.env.STORAGE_BUCKET!)
            .upload(filePath, buffer, {
                contentType: data.mimetype,
                upsert: false
            });

        if (error) {
            fastify.log.error(error);
            return reply.code(500).send({ error: 'Upload failed' });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(process.env.STORAGE_BUCKET!)
            .getPublicUrl(filePath);

        return { url: publicUrl };
    });
};
