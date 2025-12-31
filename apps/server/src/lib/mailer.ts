import { env } from '../config/env.js';

interface SendMailOptions {
    to: string;
    subject: string;
    text: string;
    html?: string;
}

export async function sendEmail(options: SendMailOptions): Promise<void> {
    const { to, subject, text } = options;

    if (env.NODE_ENV === 'development') {
        // In development, just log the email
        console.log('--- EMAIL MOCK ---');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${text}`);
        console.log('------------------');
        return;
    }

    // TODO: Implement actual email sending provider (SendGrid, AWS SES, Resend, etc.)
    // For now, we just log in production too until a provider is configured
    console.log(`[EMAIL] To: ${to}, Subject: ${subject}`);
}
