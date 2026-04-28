# Paper a Day, Doctor One Step Away

A Rednote/Xiaohongshu-style feed for arXiv papers. Open the app, scroll a
masonry grid of papers in your research area, tap any card to read the
abstract, save the ones you love. The feed learns from your behavior and
gets sharper over time.

> **Heads up:** this started as a personal project — I built it for myself
> to make reading papers feel less like a chore and more like the kind of
> infinite scroll I already do on social media. The whole stack runs on free
> tiers and costs $0/month for one user, so if you'd like to fork it for
> your own use, the setup steps below should get you running in an
> afternoon.

## Why this exists

I wanted to read more papers but kept hitting the same problems:

- The arXiv firehose is overwhelming — hundreds of new papers daily in any
  given subfield.
- Aggregator sites push popular papers, not necessarily papers in *my*
  niche.
- I love how Rednote / TikTok / Pinterest can show me five interesting
  things in a row without me having to search. Why doesn't that exist for
  research?
- I don't want to pay anyone — papers I care about are already free on
  arXiv.

So this is that app, for me, on my phone, for free.

## What it does

- Pulls the latest papers in the arXiv categories I follow, every morning.
- Embeds each abstract via a free Hugging Face model.
- Shows me a daily Rednote-style grid, ordered by a multi-armed bandit
  (Thompson Sampling) layered on top of cosine-similarity ranking.
- Tracks every implicit signal: impressions, dwell time, taps, long views,
  saves, PDF opens.
- Updates its model of my taste online — by tomorrow it knows me a little
  better.
- Saves to my phone home screen as a PWA (looks and feels like a real app,
  no app store needed).

## How to use it (once it's running)

1. Open the URL on your phone, tap **Share → Add to Home Screen** (iOS) or
   accept the install prompt (Android Chrome).
2. Open the app from the home-screen icon — it launches full-screen.
3. **Scroll the grid.** Each card is a paper. Just keep scrolling.
4. **Tap a card** to open the detail view with the full abstract.
   - **Save** to bookmark.
   - **Read PDF** to jump to the arXiv PDF.
5. **That's it.** No swiping, no rating, no thumbs up/down. Every scroll,
   pause, tap, save, and PDF-open is a signal — the algorithm builds your
   taste vector from your natural behavior.
6. New papers arrive automatically every morning at 6 AM (UTC by default;
   change in `vercel.json` to whatever fits your day).

## How the algorithm works

Three layers, each pulling its weight:

| Layer | Mechanism | Why |
|---|---|---|
| **Topic selection** | Thompson Sampling on Beta(α, β) per arXiv category. α grows with positive interactions, β with skipped impressions. | Balances explore vs. exploit at the topic level — categories you've never tried still get a fair shot, categories you love get more slots. |
| **Paper ranking** | Cosine similarity between each paper's embedding and your evolving profile vector. | Within a chosen category, surface papers closest to your tastes. |
| **Profile drift** | Exponential moving average of paper embeddings, weighted by signal strength (PDF open > save > long view > tap > dwell). | Your taste vector shifts gradually toward what you actually engage with, with noisy signals fading naturally over time. |

A small fraction of feed slots (configurable) are filled with random papers
from your categories — the anti-echo-chamber knob.

## Setup (if you want to run your own)

### 1. Supabase

1. Sign up at [supabase.com](https://supabase.com), create a new project.
2. SQL editor → paste all of [`supabase-setup.sql`](supabase-setup.sql) → Run.
3. Settings → API → grab three values:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (server-only, keep secret)

### 2. Hugging Face

1. Sign up at [huggingface.co](https://huggingface.co).
2. Settings → Access Tokens → New token (read scope) → save as
   `HUGGINGFACE_API_KEY`.

### 3. Local dev

```bash
cp .env.local.example .env.local
# fill in the 5 values

npm install
npm run dev
```

Visit `http://localhost:3000`. You'll be redirected to `/onboarding` — pick
your categories, optionally paste a few seed paper IDs, save.

To get papers immediately (instead of waiting for tomorrow's cron), trigger
ingestion manually:

```bash
curl -X POST http://localhost:3000/api/cron/ingest \
  -H "Authorization: Bearer $CRON_SECRET"
```

It takes a couple of minutes to embed ~50 abstracts. Refresh the feed.

### 4. Deploy to Vercel

1. Push to GitHub.
2. Vercel → **Add New Project** → import the repo.
3. Add the same five environment variables under
   **Settings → Environment Variables**.
4. Deploy. Vercel reads `vercel.json` and schedules the daily cron at 13:00
   UTC automatically.

### 5. Phone install

1. Drop `icon-192.png` and `icon-512.png` into `public/` (any square PNG).
2. Open `your-app.vercel.app` on your phone.
3. Add to Home Screen.

## Tweaking the algorithm

| What | Where |
|---|---|
| Reward weights per event type | `lib/types.ts` → `REWARD_WEIGHTS` |
| Profile-vector learning rate | `lib/types.ts` → `PROFILE_LR` |
| Exploration rate | `user_preferences` row, or onboarding form |
| Daily feed size | Same as above |
| Available categories | `app/onboarding/page.tsx` → `CATEGORY_GROUPS` |
| Cron schedule | `vercel.json` |

Full arXiv taxonomy: [arxiv.org/category_taxonomy](https://arxiv.org/category_taxonomy).

## Tech stack — all free for solo use

| Service | What it does | Free tier headroom |
|---|---|---|
| Vercel | Frontend + serverless functions + cron | Generous |
| Supabase | Postgres + pgvector | 500 MB |
| Hugging Face | Embeddings (`all-MiniLM-L6-v2`, 384-dim) | More than enough for ~50 papers/day |
| arXiv | Paper metadata + PDFs | Free, just rate-limit yourself |

Realistic monthly cost: **$0**.

## Future ideas

Ordered roughly by how much I want them and how easy they'd be:

- **LLM-generated TL;DRs** — call Gemini 1.5 Flash (free tier) during the
  daily ingest to turn each abstract into 2–3 short bullets. Makes cards
  feel like real social media instead of an academic database.
- **Saved library page** — a `/library` route showing all saved papers with
  a search bar, grouping by date or category.
- **Better cold start** — let users paste a research statement / abstract
  of their own thesis as the seed instead of arXiv IDs.
- **Multi-source ingestion** — pull from Semantic Scholar (better citation
  data), bioRxiv, medRxiv, OpenReview.
- **Citation-graph features** — "papers similar to this one" via co-citation
  on Semantic Scholar.
- **Cover images** — extract the first figure from each PDF as a thumbnail,
  or generate a simple SVG visual from the title. Makes the grid feel less
  uniformly textual.
- **Email digest** — a weekly Sunday summary of "the 5 papers you most
  engaged with this week."
- **Zotero / Notion export** — when you save a paper, push it straight to
  your reference manager.
- **Reading streaks** — gentle gamification for keeping the daily habit.
- **Taste-vector visualization** — a t-SNE plot of how your profile vector
  has drifted over weeks, so you can see your interests evolve.
- **Audio summaries** — TTS of TL;DRs for listening while commuting.
- **Multi-user with auth** — eventually open this up for friends and
  labmates, with proper Supabase Auth.
- **Better RL** — once there's enough data, replace the per-category
  Thompson Sampler with a contextual bandit that conditions on time of
  day, recent reading history, etc.

## Files of interest

| File | Purpose |
|---|---|
| `lib/recommender.ts` | Builds the daily feed (bandit + similarity + exploration) |
| `lib/bandit.ts` | Thompson Sampling on Beta distributions |
| `lib/embeddings.ts` | Hugging Face embedding calls + EMA helper |
| `lib/arxiv.ts` | arXiv API + XML parsing |
| `app/api/cron/ingest/route.ts` | Daily paper ingestion |
| `app/api/interactions/route.ts` | Records events, updates bandit + profile |
| `app/api/feed/route.ts` | Returns today's personalized feed |
| `components/Feed.tsx` | Masonry grid + IntersectionObserver |
| `components/Card.tsx` | Single paper card |
| `components/DetailModal.tsx` | Tap-to-open detail view |
| `supabase-setup.sql` | All schema in one runnable file |

## License

MIT — do whatever you like, no warranty. If you build something cool on top
of this, I'd love to hear about it.
