import 'node:process';
import logger from './utils/logger.js';
import { initDB, filterUnseen, markAsSent, closeDB } from './db/dbService.js';
import { fetchAllNews } from './services/newsFetcher.js';
import { summarizeAndFilter } from './services/aiService.js';
import { formatEmail } from './services/formatter.js';
import { sendEmail } from './services/emailService.js';
import { rankArticles } from './utils/scorer.js';

function validateEnv() {
    const required = ['AI_API_KEY', 'RESEND_API_KEY', 'DB_URL', 'EMAIL_TO'];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

export async function runAgent() {
    const startTime = Date.now();
    logger.info('═══════════════════════════════════════');
    logger.info('  Daily Tech News Agent — Starting Run  ');
    logger.info('═══════════════════════════════════════');

    try {
        validateEnv();

        logger.info('[worker] Step 1/8 — Initializing database');
        await initDB();

        logger.info('[worker] Step 2/8 — Fetching news from all sources');
        const rawArticles = await fetchAllNews();
        logger.info(`[worker] Fetched ${rawArticles.length} raw articles`);

        if (!rawArticles.length) {
            logger.warn('[worker] No articles fetched — aborting run');
            return;
        }

        logger.info('[worker] Step 3/8 — Deduplicating via database');
        const allLinks = rawArticles.map((a) => a.link).filter(Boolean);
        const unseenLinks = await filterUnseen(allLinks);

        const freshArticles = rawArticles.filter(
            (a) => a.link && unseenLinks.has(a.link)
        );
        logger.info(`[worker] ${freshArticles.length} fresh articles after dedup (${rawArticles.length - freshArticles.length} already sent)`);

        if (!freshArticles.length) {
            logger.warn('[worker] All articles already sent — nothing new to email');
            return;
        }

        logger.info('[worker] Step 4/8 — Scoring and ranking candidates');
        const ranked = rankArticles(freshArticles, 30);
        logger.info(`[worker] Top ${ranked.length} candidates selected by scorer`, {
            topScores: ranked.slice(0, 5).map((a) => `${a.score} — ${a.title.slice(0, 50)}`),
        });

        logger.info('[worker] Step 5/8 — AI filtering and summarizing');
        const summarized = await summarizeAndFilter(ranked);
        logger.info(`[worker] AI selected ${summarized.length} final articles`);

        if (!summarized.length) {
            logger.error('[worker] AI returned 0 articles — aborting');
            return;
        }

        logger.info('[worker] Step 6/8 — Formatting email');
        const { html, text } = formatEmail(summarized);

        logger.info('[worker] Step 7/8 — Sending email');
        const emailResult = await sendEmail({ html, text });
        logger.info('[worker] Email sent', { emailId: emailResult?.id });

        logger.info('[worker] Step 8/8 — Persisting sent articles to DB');
        await markAsSent(summarized);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.info('═══════════════════════════════════════');
        logger.info(`  ✅ Run complete in ${elapsed}s — ${summarized.length} stories sent`);
        logger.info('═══════════════════════════════════════');
    } catch (err) {
        logger.error('[worker] ❌ Fatal error during agent run', {
            error: err.message,
            stack: err.stack,
        });
        process.exitCode = 1;
    } finally {
        await closeDB();
    }
}

runAgent();