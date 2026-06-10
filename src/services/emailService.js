import { Resend } from 'resend';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { EMAIL_FROM, RESEND_API_KEY, EMAIL_TO } from '../utils/env.js';

let resend;

function getResend() {
    if (!resend) resend = new Resend(RESEND_API_KEY);
    return resend;
}

export async function sendEmail({ html, text }) {
    const from = EMAIL_FROM || 'onboarding@resend.dev';
    const to = EMAIL_TO || 'duttabipul927@gmail.com';

    if (!to) throw new Error('EMAIL_TO environment variable is not set');

    const subject = `Daily Tech Brief – Top News · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const result = await withRetry(
        async () => {
            const { data, error } = await getResend().emails.send({
                from,
                to,
                subject,
                html,
                text,
            });

            if (error) throw new Error(`Resend API error: ${JSON.stringify(error)}`);
            return data;
        },
        { attempts: 3, baseDelayMs: 2000, label: 'email:send' }
    );

    logger.info('[email] Sent successfully', { id: result?.id, to, subject });
    return result;
}