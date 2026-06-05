# Daily Tech News Agent

An automated AI-powered agent that fetches, filters, and summarizes the top tech news daily — delivered straight to your inbox.

**Stack:** Node.js · Vercel AI SDK · Gemini / OpenRouter · Resend · Insforge (PostgreSQL) · GitHub Actions

---

## Project Structure

```
daily-tech-news-agent/
├── .github/
│   └── workflows/
│       └── cron.yml          # GitHub Actions — runs daily at 07:00 UTC
├── src/
│   ├── db/
│   │   └── dbService.js      # Insforge/PostgreSQL — deduplication + persistence
│   ├── services/
│   │   ├── newsFetcher.js    # RSS + HackerNews API + Reddit API
│   │   ├── aiService.js      # Vercel AI SDK — filter + summarize
│   │   ├── emailService.js   # Resend — send HTML email
│   │   └── formatter.js      # HTML + plaintext email template
│   ├── utils/
│   │   ├── logger.js         # Structured logger
│   │   ├── retry.js          # Exponential backoff retry
│   │   └── scorer.js         # Pre-AI scoring algorithm
│   └── worker.js             # Entry point — orchestrates all steps
├── .env.example
└── package.json
```

---

## Quick Setup

### 1. Clone & Install

```bash
git clone https://github.com/Dutta2005/daily-tech-news-agent
cd daily-tech-news-agent
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your actual keys
```

### 3. Set Up Database (Insforge)

1. Go to [https://insforge.dev](https://insforge.dev) and create a free project
2. Copy the **PostgreSQL connection string** into `DB_URL` in your `.env`
3. The agent auto-creates the `articles` table on first run — no migrations needed

### 4. Set Up AI Provider

**Option A — Gemini (Free tier, recommended):**

```env
AI_PROVIDER=gemini
AI_API_KEY=your_gemini_api_key   # from https://aistudio.google.com/
GEMINI_MODEL=gemini-1.5-flash    # or gemini-1.5-pro
```

**Option B — OpenRouter (access to many free models):**

```env
AI_PROVIDER=openrouter
AI_API_KEY=your_openrouter_key   # from https://openrouter.ai/
OPENROUTER_MODEL=openrouter/free # automatically switch to the all available free models in openrouter
```

> **Switching providers:** Just change `AI_PROVIDER` in `.env`. No code changes needed.

### 5. Set Up Resend (Email)

1. Sign up at [https://resend.com](https://resend.com) (free tier: 3,000 emails/month)
2. Verify your sending domain
3. Create an API key and set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` in `.env`

### 6. Test Locally

```bash
node src/worker.js
```

Expected output:

```
[2025-...] [INFO] Step 1/8 — Initializing database
[2025-...] [INFO] Step 2/8 — Fetching news from all sources
[2025-...] [INFO] Fetched 142 raw articles
[2025-...] [INFO] 98 fresh articles after dedup
...
[2025-...] [INFO] ✅ Run complete in 18.4s — 10 stories sent
```

---

## GitHub Actions Setup

### Add Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret Name      | Value                      |
| ---------------- | -------------------------- |
| `AI_PROVIDER`    | `gemini` or `openrouter`   |
| `AI_API_KEY`     | Your API key               |
| `RESEND_API_KEY` | Your Resend key            |
| `EMAIL_FROM`     | `news@yourdomain.com`      |
| `EMAIL_TO`       | Your email address         |
| `DB_URL`         | Insforge connection string |

### Optional Variables (Settings → Variables)

| Variable                | Default | Description                |
| ----------------------- | ------- | -------------------------- |
| `TOP_ARTICLES_COUNT`    | `8`     | Number of stories in email |
| `MAX_ARTICLE_AGE_HOURS` | `25`    | Max article age to include |

### Schedule

The workflow runs at **07:00 UTC daily**. To change the time, edit `.github/workflows/cron.yml`:

```yaml
# Runs at 08:30 UTC (example)
- cron: "30 8 * * *"
```

Use [crontab.guru](https://crontab.guru) to build your schedule.

### Manual Trigger

You can trigger the agent manually from **Actions → Daily Tech News Agent → Run workflow**.

---

## Architecture Flow

```
GitHub Actions (cron)
        │
        ▼
   runAgent() — worker.js
        │
        ├─ 1. initDB()           → Create table if not exists
        ├─ 2. fetchAllNews()     → TechCrunch RSS + HN API + Reddit API (parallel)
        ├─ 3. filterUnseen()     → Remove already-sent articles via DB hash lookup
        ├─ 4. rankArticles()     → Score by keyword relevance + recency + HN score
        ├─ 5. summarizeAndFilter() → AI selects top N, writes 2–3 line summaries
        ├─ 6. formatEmail()      → Build HTML + plaintext email
        ├─ 7. sendEmail()        → Resend API
        └─ 8. markAsSent()       → Store article links/hashes in DB
```

---

## 🛠 Customization

### Add More RSS Sources

In `src/services/newsFetcher.js`, add to `RSS_SOURCES`:

```js
{ name: 'Wired', url: 'https://www.wired.com/feed/rss' },
{ name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
```

### Change AI Priorities

In `src/services/aiService.js`, edit the prompt inside `buildPrompt()`:

```
Prioritize in this order: Security > Cloud Infrastructure > AI
```

### Adjust Scoring Weights

In `src/utils/scorer.js`, tune `KEYWORD_WEIGHTS` to match your interests.

---

## Database Schema

```sql
CREATE TABLE articles (
  id           SERIAL PRIMARY KEY,
  title        TEXT        NOT NULL,
  link         TEXT        NOT NULL UNIQUE,
  link_hash    CHAR(64)    NOT NULL UNIQUE,  -- SHA-256 for fast dedup
  source       TEXT        NOT NULL,
  published_at TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score        NUMERIC(6,2)
);
```

---

## Troubleshooting

**Agent fetched articles but sent nothing**
→ All articles were already in the DB. Wait 24h or clear the `articles` table for testing:

```sql
TRUNCATE articles;
```

**AI returned 0 articles**
→ Check your `AI_API_KEY` and `AI_PROVIDER` settings. The agent falls back gracefully to the top-scored articles.

**Email not arriving**
→ Check Resend dashboard for delivery status. Ensure `EMAIL_FROM` domain is verified in Resend.

**Database connection error**
→ Ensure `DATABASE_URL` includes `?sslmode=require` if your Insforge instance requires SSL.
