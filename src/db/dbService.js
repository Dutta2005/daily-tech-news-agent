import { createHash } from 'crypto';
import logger from "../utils/logger.js";
import { DB_URL } from '../utils/env.js';

let pool;

async function getPool() {
    if (pool) return pool;

    const { default: pg } = await import('pg');
    const { Pool } = pg;

    pool = new Pool({
        connectionString: DB_URL,
        ssl: {
            rejectUnauthorized: false
        },
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
    });

    pool.on('error', (err) => logger.error('[db] Unexpected pool error', { error: err.message }));
    return pool;
}

function hashLink(link) {
    return createHash('sha256').update(link.trim().toLowerCase()).digest('hex');
}

export async function initDB() {
    const db = await getPool();
    await db.query(`
    CREATE TABLE IF NOT EXISTS articles (
      id           SERIAL PRIMARY KEY,
      title        TEXT        NOT NULL,
      link         TEXT        NOT NULL UNIQUE,
      link_hash    CHAR(64)    NOT NULL UNIQUE,
      source       TEXT        NOT NULL,
      published_at TIMESTAMPTZ,
      sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      score        NUMERIC(6,2)
    );
 
    CREATE INDEX IF NOT EXISTS idx_articles_link_hash ON articles (link_hash);
    CREATE INDEX IF NOT EXISTS idx_articles_sent_at   ON articles (sent_at DESC);
  `);
    logger.info('[db] Schema initialized');
}

export async function filterUnseen(links) {
    if (!links.length) return new Set();

    const db = await getPool();
    const hashes = links.map(hashLink);

    const { rows } = await db.query(
        `SELECT link_hash FROM articles WHERE link_hash = ANY($1::text[])`,
        [hashes]
    );

    const seenHashes = new Set(rows.map((r) => r.link_hash));
    const unseenLinks = links.filter((l) => !seenHashes.has(hashLink(l)));
    return new Set(unseenLinks);
}

export async function markAsSent(articles) {
    if (!articles.length) return;

    const db = await getPool();
    const now = new Date();

    const values = articles.map((a, i) => {
        const base = i * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
    });

    const params = articles.flatMap((a) => [
        a.title,
        a.link,
        hashLink(a.link),
        a.source,
        a.publishedAt ? new Date(a.publishedAt) : null,
        a.score ?? 0,
    ]);

    await db.query(
        `INSERT INTO articles (title, link, link_hash, source, published_at, score)
     VALUES ${values.join(', ')}
     ON CONFLICT (link_hash) DO NOTHING`,
        params
    );

    logger.info(`[db] Marked ${articles.length} articles as sent`);
}

export async function closeDB() {
    if (pool) {
        await pool.end();
        pool = null;
        logger.info('[db] Pool closed');
    }
}