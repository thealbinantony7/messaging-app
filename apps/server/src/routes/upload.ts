import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import type { GetUploadUrlRequest, GetUploadUrlResponse } from '@linkup/shared';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const getSupabaseClient = () => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
        throw new Error('Supabase credentials not configured');
    }
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
};

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
    // Auth middleware
    fastify.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
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

        let buffer: Buffer;
        try {
            buffer = await data.toBuffer();
        } catch (err) {
            fastify.log.error({ err }, 'Failed to read key file');
            return reply.code(400).send({ error: 'File transfer failed' });
        }

        if (buffer.length > MAX_IMAGE_SIZE) {
            return reply.code(400).send({ error: 'Image too large (max 10MB)' });
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${data.mimetype.split('/')[1]}`;
        const filePath = `images/${fileName}`;

        // Check for bucket config
        if (!process.env.STORAGE_BUCKET) {
            fastify.log.error('STORAGE_BUCKET env var missing');
            return reply.code(500).send({ error: 'Server configuration error: Bucket missing' });
        }

        const supabase = getSupabaseClient();

        const { error } = await supabase.storage
            .from(process.env.STORAGE_BUCKET)
            .upload(filePath, buffer, {
                contentType: data.mimetype,
                upsert: false
            });

        if (error) {
            fastify.log.error({ error, bucket: process.env.STORAGE_BUCKET }, 'Supabase upload failed');
            return reply.code(500).send({ error: `Upload failed: ${error.message}` });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(process.env.STORAGE_BUCKET!)
            .getPublicUrl(filePath);

        return { url: publicUrl };
    });
};
