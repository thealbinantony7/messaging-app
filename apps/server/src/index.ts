import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { authRoutes } from './routes/auth.js';
import { conversationRoutes } from './routes/conversations.js';
import { messageRoutes } from './routes/messages.js';
import { uploadRoutes } from './routes/upload.js';
import { aiRoutes } from './routes/ai.js';
import inviteRoutes from './routes/invite.js';
import { createWebsocketHandler } from './ws/handler.js';

const app = Fastify({
    logger: env.NODE_ENV === 'development'
        ? {
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname',
                },
            },
        }
        : true,
});

// Register plugins
await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
});

await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
});

await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
});

await app.register(websocket);

await app.register(multipart, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    }
});

// Health check
app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// API routes
app.register(authRoutes, { prefix: '/api/auth' });
app.register(conversationRoutes, { prefix: '/api/conversations' });
app.register(messageRoutes, { prefix: '/api/messages' });
app.register(uploadRoutes, { prefix: '/api/upload' });
app.register(aiRoutes, { prefix: '/api/ai' });
app.register(inviteRoutes, { prefix: '/api' });

// WebSocket
app.register(async function (fastify) {
    const wsHandler = createWebsocketHandler(app);
    fastify.get('/ws', { websocket: true }, wsHandler);
});

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
    process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        process.exit(0);
    });
});

// Start server
try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Server listening on ${env.HOST}:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`CORS Origin: ${env.CORS_ORIGIN ? env.CORS_ORIGIN.replace(/https?:\/\//, '') + ' (masked)' : 'NOT SET'}`);
} catch (err) {
    logger.error(err);
    process.exit(1);
}
