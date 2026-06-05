export function formatEmail(articles) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Tech Brief</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #f4f5f7;
      color: #1a1a2e;
      line-height: 1.6;
    }
    .wrapper { max-width: 680px; margin: 0 auto; padding: 24px 16px; }

    /* Header */
    .header {
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      border-radius: 12px 12px 0 0;
      padding: 36px 40px;
      text-align: center;
    }
    .header-emoji { font-size: 40px; margin-bottom: 12px; }
    .header h1 {
      color: #ffffff;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .header .subtitle {
      color: #a8b4d8;
      font-size: 14px;
      margin-top: 6px;
    }
    .header .date-badge {
      display: inline-block;
      background: rgba(255,255,255,0.12);
      color: #c9d4f0;
      border-radius: 20px;
      padding: 4px 14px;
      font-size: 13px;
      margin-top: 14px;
    }

    /* Body container */
    .body {
      background: #ffffff;
      padding: 32px 40px;
      border-left: 1px solid #e5e7eb;
      border-right: 1px solid #e5e7eb;
    }
    .intro {
      color: #6b7280;
      font-size: 15px;
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 2px solid #f3f4f6;
    }

    /* Article card */
    .article {
      margin-bottom: 28px;
      padding-bottom: 28px;
      border-bottom: 1px solid #f3f4f6;
    }
    .article:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

    .article-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .article-number {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      background: #4f46e5;
      color: #fff;
      border-radius: 50%;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 2px;
    }
    .article-title {
      font-size: 17px;
      font-weight: 700;
      color: #111827;
      line-height: 1.4;
    }
    .article-title a { color: #111827; text-decoration: none; }
    .article-title a:hover { color: #4f46e5; }

    .article-summary {
      color: #4b5563;
      font-size: 14px;
      line-height: 1.65;
      margin-left: 40px;
      margin-bottom: 12px;
    }

    .article-meta {
      margin-left: 40px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .source-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f3f4f6;
      color: #6b7280;
      border-radius: 6px;
      padding: 3px 10px;
      font-size: 12px;
      font-weight: 500;
    }
    .read-link {
      display: inline-block;
      background: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      padding: 4px 14px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }

    /* Footer */
    .footer {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 24px 40px;
      text-align: center;
    }
    .footer p { color: #9ca3af; font-size: 12px; line-height: 1.8; }
    .footer .powered { font-weight: 600; color: #6b7280; }
  </style>
</head>
<body>
  <div class="wrapper">
    <!-- Header -->
    <div class="header">
      <div class="header-emoji">🚀</div>
      <h1>Daily Tech Brief</h1>
      <p class="subtitle">Your curated digest of what matters in tech — filtered by AI</p>
      <span class="date-badge">📅 ${date}</span>
    </div>

    <!-- Body -->
    <div class="body">
      <p class="intro">
        Here are today's <strong>${articles.length} top tech stories</strong>, 
        handpicked and summarized from TechCrunch, Hacker News, Reddit, and more.
      </p>

      ${articles.map((article, i) => renderArticle(article, i + 1)).join('\n')}
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="powered">⚡ Powered by Daily Tech News Agent</p>
      <p>Sources: TechCrunch · The Verge · Ars Technica · Hacker News · Reddit r/technology</p>
      <p>AI-curated and summarized · Delivered daily</p>
    </div>
  </div>
</body>
</html>`;

  const text = buildPlainText(articles, date);

  return { html, text };
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function renderArticle(article, num) {
  const escapedTitle = escapeHtml(article.title);
  const escapedSummary = escapeHtml(article.summary);
  const escapedSource = escapeHtml(article.source);

  return `
      <div class="article">
        <div class="article-header">
          <span class="article-number">${num}</span>
          <span class="article-title">
            <a href="${article.link}" target="_blank" rel="noopener noreferrer">${escapedTitle}</a>
          </span>
        </div>
        <p class="article-summary">${escapedSummary}</p>
        <div class="article-meta">
          <span class="source-badge">📰 ${escapedSource}</span>
          <a class="read-link" href="${article.link}" target="_blank" rel="noopener noreferrer">Read →</a>
        </div>
      </div>`;
}

function buildPlainText(articles, date) {
  const lines = [
    `🚀 DAILY TECH BRIEF — ${date}`,
    '='.repeat(50),
    '',
    ...articles.flatMap((a, i) => [
      `${i + 1}. ${a.title}`,
      `   Source: ${a.source}`,
      `   ${a.summary}`,
      `   🔗 ${a.link}`,
      '',
    ]),
    '─'.repeat(50),
    'Powered by Daily Tech News Agent | AI-curated daily digest',
  ];
  return lines.join('\n');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}