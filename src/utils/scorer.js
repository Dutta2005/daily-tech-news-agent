const KEYWORD_WEIGHTS = [
  { weight: 10, terms: ['ai', 'artificial intelligence', 'llm', 'gpt', 'gemini', 'openai', 'anthropic', 'claude', 'machine learning', 'deep learning'] },
  { weight: 8, terms: ['developer tools', 'open source', 'github', 'api', 'sdk', 'framework', 'release', 'launch'] },
  { weight: 7, terms: ['security', 'breach', 'vulnerability', 'privacy', 'regulation', 'law'] },
  { weight: 5, terms: ['startup', 'funding', 'series a', 'series b', 'ipo', 'acquisition', 'unicorn', 'raised'] },
  { weight: 4, terms: ['apple', 'google', 'microsoft', 'meta', 'amazon', 'nvidia', 'tesla'] },
  { weight: 2, terms: ['cloud', 'saas', 'infrastructure', 'kubernetes', 'docker'] },
];

const HN_SCORE_DIVISOR = 100;
const RECENCY_DECAY_HOURS = 12;

export function scoreArticle(article) {
  const textBlob = `${article.title} ${article.description ?? ''}`.toLowerCase();
  let score = 0;

  for (const { weight, terms } of KEYWORD_WEIGHTS) {
    for (const term of terms) {
      if (textBlob.includes(term)) {
        score += weight;
        break;
      }
    }
  }

  if (article.hnScore) {
    score += Math.min(article.hnScore / HN_SCORE_DIVISOR, 5);
  }

  if (article.publishedAt) {
    const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3_600_000;
    if (ageHours < RECENCY_DECAY_HOURS) {
      score += (1 - ageHours / RECENCY_DECAY_HOURS) * 3;
    }
  }

  return parseFloat(score.toFixed(2));
}

export function rankArticles(articles, topN = 20) {
  return articles
    .map((a) => ({ ...a, score: scoreArticle(a) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}