import Parser from 'rss-parser';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { MAX_ARTICLE_AGE_HOURS } from '../utils/env.js';

const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'DailyTechNewsAgent/1.0' } });

const MAX_AGE_HOURS = Number(MAX_ARTICLE_AGE_HOURS) || 25;

const RSS_SOURCES = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
];

const GITHUB_TRENDING_FEEDS = [
    { lang: 'all', url: 'https://github-rss.alexi.sh/trending/daily/any/any.rss' },
    { lang: 'javascript', url: 'https://github-rss.alexi.sh/trending/daily/javascript/any.rss' },
    { lang: 'python', url: 'https://github-rss.alexi.sh/trending/daily/python/any.rss' },
    { lang: 'typescript', url: 'https://github-rss.alexi.sh/trending/daily/typescript/any.rss' },
];

function normalizeArticle(raw) {
    return {
        title: raw.title,
        link: raw.link,
        description: raw.description || '',
        source: raw.source,
        publishedAt: raw.publishedAt || null,
        hnScore: raw.hnScore || 0,
    };
}

function isRecent(dateInput) {
    if (!dateInput) return true;
    const age = (Date.now() - new Date(dateInput).getTime()) / 3_600_000;
    return age <= MAX_AGE_HOURS;
}

function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

async function batchFetch(items, batchSize, fetchFn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const settled = await Promise.allSettled(batch.map(fetchFn));
        results.push(...settled.filter((r) => r.status === 'fulfilled').map((r) => r.value));
    }
    return results;
}


export async function fetchAllNews() {
    const [rssArticles, hnArticles, githubArticles] = await Promise.allSettled([
        fetchRSSFeeds(),
        fetchHackerNews(),
        fetchGitHubTrending(),
    ]);

    const results = [];

    for (const [label, settled] of [
        ['RSS', rssArticles],
        ['HackerNews', hnArticles],
        ['GitHub Trending', githubArticles],
    ]) {
        if (settled.status === 'fulfilled') {
            results.push(...settled.value);
            logger.info(`[fetcher] ${label}: ${settled.value.length} articles`);
        } else {
            logger.error(`[fetcher] ${label} failed`, { error: settled.reason?.message });
        }
    }

    return results;
}

async function fetchRSSFeeds() {
    const results = await Promise.allSettled(RSS_SOURCES.map(fetchSingleRSS));
    const articles = [];

    for (const r of results) {
        if (r.status === 'fulfilled') articles.push(...r.value);
        else logger.warn('[fetcher] RSS source failed', { error: r.reason?.message });
    }

    return articles;
}

async function fetchSingleRSS({ name, url }) {
    return withRetry(
        async () => {
            const feed = await parser.parseURL(url);
            return feed.items
                .filter((item) => isRecent(item.pubDate || item.isoDate))
                .map((item) => normalizeArticle({
                    title: item.title?.trim() ?? 'Untitled',
                    link: item.link ?? item.guid,
                    description: stripHtml(item.contentSnippet || item.content || item.summary || '').slice(0, 300),
                    source: name,
                    publishedAt: item.pubDate || item.isoDate,
                }));
        },
        { attempts: 3, baseDelayMs: 1000, label: `RSS:${name}` }
    );
}

async function fetchHackerNews() {
    return withRetry(
        async () => {
            const { default: fetch } = await import('node-fetch');

            const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
                signal: AbortSignal.timeout(8000),
            });
            const ids = (await idsRes.json()).slice(0, 60);

            const stories = await batchFetch(ids, 20, async (id) => {
                const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                    signal: AbortSignal.timeout(5000),
                });
                return r.json();
            });

            return stories
                .filter((s) => s && s.url && s.type === 'story' && isRecent(s.time * 1000))
                .map((s) =>
                    normalizeArticle({
                        title: s.title?.trim() ?? 'Untitled',
                        link: s.url,
                        description: s.text
                            ? stripHtml(s.text).slice(0, 300)
                            : `${s.score} points · ${s.descendants ?? 0} comments on Hacker News`,
                        source: 'Hacker News',
                        publishedAt: new Date(s.time * 1000).toISOString(),
                        hnScore: s.score,
                    })
                );
        },
        { attempts: 3, baseDelayMs: 2000, label: 'HackerNews' }
    );
}

async function fetchGitHubTrending() {
    const settled = await Promise.allSettled(GITHUB_TRENDING_FEEDS.map(fetchGitHubFeed));

    const seen = new Set();
    const repos = [];

    for (const r of settled) {
        if (r.status !== 'fulfilled') continue;
        for (const repo of r.value) {
            if (!seen.has(repo.link)) {
                seen.add(repo.link);
                repos.push(repo);
            }
        }
    }

    if (repos.length > 0) return repos;

    logger.warn('[fetcher] GitHub RSS proxy failed — falling back to HTML scrape');
    return fetchGitHubTrendingFallback();
}

async function fetchGitHubFeed({ lang, url }) {
    return withRetry(
        async () => {
            const feed = await parser.parseURL(url);
            return feed.items.map((item) => {
                const repoPath = item.link?.replace('https://github.com/', '') ?? '';
                const [owner, repo] = repoPath.split('/');
                const description = stripHtml(item.contentSnippet || item.content || item.summary || '')
                    .replace(/\n+/g, ' ')
                    .trim()
                    .slice(0, 300);

                return normalizeArticle({
                    title: item.title?.trim() ?? repoPath,
                    link: item.link,
                    description: description || `Trending ${lang !== 'all' ? lang + ' ' : ''}repository on GitHub`,
                    source: 'GitHub Trending',
                    publishedAt: null,
                    hnScore: 0,
                });
            });
        },
        { attempts: 2, baseDelayMs: 1000, label: `GitHub:${lang}` }
    );
}

async function fetchGitHubTrendingFallback() {
    return withRetry(
        async () => {
            const { default: fetch } = await import('node-fetch');
            const res = await fetch('https://github.com/trending?since=daily', {
                headers: { 'User-Agent': 'DailyTechNewsAgent/1.0', Accept: 'text/html' },
                signal: AbortSignal.timeout(10_000),
            });

            if (!res.ok) throw new Error(`GitHub Trending returned ${res.status}`);
            const html = await res.text();

            const repoPattern = /<h2[^>]*>\s*<a\s+href="\/([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
            const descPattern = /<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/g;

            const repos = [];
            let match;
            const titles = [];

            while ((match = repoPattern.exec(html)) !== null) {
                const path = match[1].trim();
                const title = stripHtml(match[2]).replace(/\s+/g, ' ').trim();
                if (path.includes('/') && !path.startsWith('trending')) {
                    titles.push({ path, title });
                }
            }

            const descs = [];
            while ((match = descPattern.exec(html)) !== null) {
                descs.push(stripHtml(match[1]).trim());
            }

            for (let i = 0; i < Math.min(titles.length, 25); i++) {
                const { path, title } = titles[i];
                repos.push(normalizeArticle({
                    title: title || path,
                    link: `https://github.com/${path}`,
                    description: descs[i] || 'Trending repository on GitHub today',
                    source: 'GitHub Trending',
                    publishedAt: null,
                    hnScore: 0,
                }));
            }

            return repos;
        },
        { attempts: 3, baseDelayMs: 2000, label: 'GitHub:fallback' }
    );
}