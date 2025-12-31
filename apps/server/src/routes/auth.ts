import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { User, AuthResponse } from '@linkup/shared';
import { query, queryOne } from '../lib/db.js';
import { generateRefreshToken, hashToken, hashPassword, verifyPassword } from '../lib/auth.js';
import { env } from '../config/env.js';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    displayName: z.string().min(2, 'Name must be at least 2 characters'),
});

const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});

// JWT payload type
interface JwtPayload {
    id: string;
    email: string;
}

// Refresh token TTL in seconds (30 days)
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

export const authRoutes: FastifyPluginAsync = async (fastify) => {
    // Login with Password
    fastify.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
        try {
            const body = loginSchema.parse(request.body);
            const { email, password } = body;

            // Find user by email
            const userResult = await queryOne<{
                id: string;
                email: string;
                password_hash: string;
                display_name: string;
                avatar_url: string | null;
                status: string | null;
                last_seen_at: string | null;
                created_at: string;
            }>(
                'SELECT id, email, password_hash, display_name, avatar_url, status, last_seen_at, created_at FROM users WHERE email = $1',
                [email]
            );

            if (!userResult) {
                // Use fake verification to prevent timing attacks
                await verifyPassword('dummy', '$2a$12$dummyhashtopreventtimingattack0000000000000000000000');
                return reply.code(401).send({ error: 'Invalid email or password' });
            }

            // Verify password
            const validPassword = await verifyPassword(password, userResult.password_hash);
            if (!validPassword) {
                return reply.code(401).send({ error: 'Invalid email or password' });
            }

            // Transform to User object
            const user: User = {
                id: userResult.id,
                email: userResult.email,
                displayName: userResult.display_name,
                avatarUrl: userResult.avatar_url,
                status: userResult.status,
                lastSeenAt: userResult.last_seen_at,
                createdAt: userResult.created_at,
            };

            // Generate tokens
            const accessToken = fastify.jwt.sign(
                { id: user.id, email: user.email } as JwtPayload,
                { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
            );

            const refreshToken = generateRefreshToken();
            const refreshTokenHash = hashToken(refreshToken);

            // Store refresh token
            await query(
                `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
           VALUES ($1, $2, NOW() + $3::interval)`,
                [user.id, refreshTokenHash, `${REFRESH_TOKEN_TTL} seconds`]
            );

            // Update last seen
            await query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

            return {
                accessToken,
                refreshToken,
                user,
            };
        } catch (err) {
            fastify.log.error(err);
            return reply.code(500).send({
                error: (err as any).name === 'ZodError' ? 'Invalid input' : 'Internal server error',
                details: (err as Error).message
            });
        }
    });

    // Register with Password
    fastify.post<{ Body: { email: string; password: string; displayName: string } }>('/register', async (request, reply) => {
        try {
            fastify.log.info({ body: request.body }, 'Registering user started');
            const body = registerSchema.parse(request.body);
            const { email, password, displayName } = body;

            // Check if email exists
            fastify.log.info('Checking existing user');
            const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
            if (existing) {
                return reply.code(409).send({ error: 'Email already registered' });
            }

            // Hash password
            fastify.log.info('Hashing password');
            const passwordHash = await hashPassword(password);

            // Create user
            fastify.log.info('Inserting user into DB');
            const rows = await query<User>(
                `INSERT INTO users (email, password_hash, display_name) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, display_name as "displayName", avatar_url as "avatarUrl", status, last_seen_at as "lastSeenAt", created_at as "createdAt"`,
                [email, passwordHash, displayName]
            );

            const user = rows[0];
            if (!user) {
                throw new Error('User creation failed - no row returned');
            }
            fastify.log.info({ user: user.id }, 'User created');

            // Generate tokens
            fastify.log.info('Signing JWT');
            const accessToken = fastify.jwt.sign(
                { id: user.id, email: user.email } as JwtPayload,
                { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
            );

            const refreshToken = generateRefreshToken();
            const refreshTokenHash = hashToken(refreshToken);

            fastify.log.info('Inserting refresh token');
            await query(
                `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
         VALUES ($1, $2, NOW() + $3::interval)`,
                [user.id, refreshTokenHash, `${REFRESH_TOKEN_TTL} seconds`]
            );

            fastify.log.info('Registration complete');
            return {
                accessToken,
                refreshToken,
                user,
            };
        } catch (err) {
            fastify.log.error(err);
            const error = err as any;
            return reply.code(500).send({
                error: error.name === 'ZodError' ? 'Invalid input' : 'Failed to create account',
                details: error.message,
                stack: env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    });

    // Refresh access token
    fastify.post<{ Body: { refreshToken: string } }>('/refresh', async (request, reply) => {
        const body = refreshSchema.parse(request.body);
        const { refreshToken } = body;

        const tokenHash = hashToken(refreshToken);

        // Find valid refresh token
        const tokenRecord = await queryOne<{ id: string; user_id: string }>(
            `SELECT id, user_id FROM refresh_tokens 
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL`,
            [tokenHash]
        );

        if (!tokenRecord) {
            return reply.code(401).send({ error: 'Invalid or expired refresh token' });
        }

        // Get user
        const user = await queryOne<User>(
            'SELECT id, email, display_name as "displayName", avatar_url as "avatarUrl", status, last_seen_at as "lastSeenAt", created_at as "createdAt" FROM users WHERE id = $1',
            [tokenRecord.user_id]
        );

        if (!user) {
            return reply.code(401).send({ error: 'User not found' });
        }

        // Generate new access token
        const accessToken = fastify.jwt.sign(
            { id: user.id, email: user.email } as JwtPayload,
            { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
        );

        // Optionally rotate refresh token
        const newRefreshToken = generateRefreshToken();
        const newRefreshTokenHash = hashToken(newRefreshToken);

        // Revoke old token and create new one
        await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [tokenRecord.id]);
        await query(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
       VALUES ($1, $2, NOW() + $3::interval)`,
            [user.id, newRefreshTokenHash, `${REFRESH_TOKEN_TTL} seconds`]
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
            user,
        };
    });

    // Logout (revoke refresh token)
    fastify.post<{ Body: { refreshToken: string } }>('/logout', async (request, reply) => {
        const { refreshToken } = request.body || {};

        if (refreshToken) {
            const tokenHash = hashToken(refreshToken);
            await query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1', [tokenHash]);
        }

        return { success: true };
    });

    // Get current user (requires auth)
    fastify.get('/me', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const payload = request.user as JwtPayload;

        const user = await queryOne<User>(
            'SELECT id, email, display_name as "displayName", avatar_url as "avatarUrl", status, last_seen_at as "lastSeenAt", created_at as "createdAt" FROM users WHERE id = $1',
            [payload.id]
        );

        if (!user) {
            return reply.code(404).send({ error: 'User not found' });
        }

        return { user };
    });

    // Update profile
    fastify.patch<{ Body: { displayName?: string; status?: string } }>('/me', async (request, reply) => {
        try {
            await request.jwtVerify();
        } catch (err) {
            return reply.code(401).send({ error: 'Unauthorized' });
        }

        const payload = request.user as JwtPayload;
        const { displayName, status } = request.body || {};

        const updates: string[] = [];
        const values: unknown[] = [];
        let paramIndex = 1;

        if (displayName !== undefined) {
            updates.push(`display_name = $${paramIndex++}`);
            values.push(displayName);
        }
        if (status !== undefined) {
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }

        if (updates.length === 0) {
            return reply.code(400).send({ error: 'No updates provided' });
        }

        values.push(payload.id);
        const user = await queryOne<User>(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, email, display_name as "displayName", avatar_url as "avatarUrl", status, last_seen_at as "lastSeenAt", created_at as "createdAt"`,
            values
        );

        return { user };
    });
};
