import { generateText } from 'ai';
import logger from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { AI_API_KEY, AI_PROVIDER, GEMINI_MODEL, OPENROUTER_MODEL, TOP_ARTICLES_COUNT } from '../utils/env.js';

const TOP_N = Number(TOP_ARTICLES_COUNT) || 10;

async function buildModel() {
    const provider = AI_PROVIDER?.toLowerCase() || 'gemini';

    if (provider === 'gemini') {
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const google = createGoogleGenerativeAI({ apiKey: AI_API_KEY });
        const modelId = GEMINI_MODEL || 'gemini-flash-lite-latest';
        logger.info(`[ai] Using Gemini → ${modelId}`);
        return google(modelId);
    }

    if (provider === 'openrouter') {
        const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
        const openrouter = createOpenRouter({ apiKey: AI_API_KEY });
        const modelId = OPENROUTER_MODEL || 'openrouter/free';
        logger.info(`[ai] Using OpenRouter → ${modelId}`);
        return openrouter(modelId);
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
}

export async function summarizeAndFilter(articles) {
    if (!articles.length) return [];

    const model = await buildModel();

    const prompt = buildPrompt(articles);

    const raw = await withRetry(
        async () => {
            const { text } = await generateText({
                model,
                prompt,
                temperature: 0.3,
                maxTokens: 2000,
            });
            return text;
        },
        { attempts: 3, baseDelayMs: 2000, label: 'AI:summarize' }
    );

    return parseAIResponse(raw, articles);
}

function buildPrompt(articles) {
    const articlesJson = articles.map((a, i) => ({
        index: i,
        title: a.title,
        description: a.description,
        source: a.source,
        link: a.link,
        score: a.score,
    }));

    return `You are an expert tech journalist and curator. Your job is to select and summarize the most important tech news stories from a list of candidate articles.
 
INPUT ARTICLES (${articles.length} candidates):
${JSON.stringify(articlesJson, null, 2)}
 
INSTRUCTIONS:
1. Select the top ${TOP_N} most important and interesting stories.
2. Prioritize in this order: AI/ML breakthroughs > Startup funding/acquisitions > Developer tools/OSS releases > Security/Privacy > Big Tech news.
3. Remove duplicate or highly similar stories — keep only the best version.
4. For each selected story, write a 2–3 sentence summary that is informative, neutral, and engaging.
5. Do NOT include stories that are opinion pieces, listicles, or promotional content unless they are genuinely important.
 
OUTPUT FORMAT (strict JSON, no markdown, no commentary outside JSON):
{
  "selected": [
    {
      "index": <original index from input>,
      "title": "<keep original title>",
      "summary": "<your 2-3 sentence summary>",
      "link": "<keep original link>",
      "source": "<keep original source>"
    }
  ]
}
 
Return ONLY the JSON object. No preamble, no explanation.`;
}

function parseAIResponse(raw, originalArticles) {
    try {
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (!Array.isArray(parsed?.selected)) {
            throw new Error('Response missing "selected" array');
        }

        return parsed.selected.map((item) => {
            const original = originalArticles[item.index] ?? {};
            return {
                title: item.title || original.title,
                summary: item.summary || original.description,
                link: item.link || original.link,
                source: item.source || original.source,
                publishedAt: original.publishedAt,
                score: original.score,
            };
        });
    } catch (err) {
        logger.error('[ai] Failed to parse AI response — falling back to top articles', {
            error: err.message,
            rawSnippet: raw.slice(0, 200),
        });

        return originalArticles.slice(0, TOP_N).map((a) => ({
            title: a.title,
            summary: a.description || 'No summary available.',
            link: a.link,
            source: a.source,
            publishedAt: a.publishedAt,
            score: a.score,
        }));
    }
}
