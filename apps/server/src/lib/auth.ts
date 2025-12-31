import { createHmac, randomBytes } from 'crypto';
import { redis } from './redis.js';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

const OTP_LENGTH = 6;
const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_MAX_ATTEMPTS = 3;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
export function generateOtp(): string {
    // Generate random bytes and convert to 6-digit number
    const bytes = randomBytes(4);
    const num = bytes.readUInt32BE(0) % 1000000;
    return num.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Store OTP in Redis with TTL and attempt tracking
 */
export async function storeOtp(email: string, otp: string): Promise<void> {
    const key = `otp:${email}`;
    const data = JSON.stringify({
        otp,
        attempts: 0,
        createdAt: Date.now(),
    });
    await redis.setex(key, OTP_TTL_SECONDS, data);
}

/**
 * Verify OTP and handle attempt tracking
 * Returns: { valid: boolean, error?: string }
 */
export async function verifyOtp(
    email: string,
    inputOtp: string
): Promise<{ valid: boolean; error?: string }> {
    const key = `otp:${email}`;
    const data = await redis.get(key);

    if (!data) {
        return { valid: false, error: 'OTP expired or not found' };
    }

    const parsed = JSON.parse(data) as { otp: string; attempts: number; createdAt: number };

    // Check max attempts
    if (parsed.attempts >= OTP_MAX_ATTEMPTS) {
        await redis.del(key);
        return { valid: false, error: 'Too many attempts, please request a new OTP' };
    }

    // Increment attempts
    parsed.attempts += 1;
    const ttl = await redis.ttl(key);
    await redis.setex(key, ttl > 0 ? ttl : OTP_TTL_SECONDS, JSON.stringify(parsed));

    // Verify OTP
    if (parsed.otp !== inputOtp) {
        return { valid: false, error: 'Invalid OTP' };
    }

    // OTP verified, delete it
    await redis.del(key);
    return { valid: true };
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Hash a refresh token for storage
 */
export function hashToken(token: string): string {
    return createHmac('sha256', 'linkup-refresh-salt').update(token).digest('hex');
}

/**
 * Generate a secure refresh token
 */
export function generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
}
