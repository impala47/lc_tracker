# ⚡ Automated LeetCode A2Z Tracker

A self-updating dashboard that tracks your progress through **Striver's A2Z DSA Sheet** by
syncing directly with LeetCode's GraphQL backend. Zero manual ticking — a scheduled GitHub
Action pulls your recent accepted submissions, marks matching problems solved, and redeploys
the static site to GitHub Pages.

## How it works (Ahead-of-Time static pipeline)

GitHub Pages serves only static files and the browser can't call LeetCode directly (CORS), so
all data is compiled ahead of time:

```
GitHub Actions cron (every 6h)
        │
        ▼
scripts/sync.py ──(GraphQL)──▶ recent accepted submissions
        │
        ▼
match titleSlug ▶ update data/striver_sheet.json
        │
        ▼
commit ▶ deploy workflow rebuilds & publishes to GitHub Pages
        │
        ▼
Static React frontend loads instantly via CDN
```

`data/striver_sheet.json` is the single source of truth (~470 problems). The frontend reads it
at runtime; `scripts/sync.py` is the only thing that writes it.

## Project layout

| Path | Purpose |
| --- | --- |
| `data/striver_sheet.json` | Source-of-truth list of all A2Z problems + solved status |
| `scripts/sync.py` | Fetches recent AC submissions, updates the JSON |
| `.github/workflows/sync_leetcode.yml` | Cron (every 6h) + manual sync |
| `.github/workflows/deploy.yml` | Builds and deploys the site to GitHub Pages |
| `src/` | React + TypeScript + Tailwind dashboard |

### Dashboard components

- **Progress analytics** — global `solved / total` badge and Easy/Medium/Hard gauges.
- **Activity heatmap** — GitHub-style contribution grid keyed off `lastSolved`.
- **Sheet accordion** — collapsible Step → Lecture → problem rows with difficulty badges,
  solved/unsolved tags, "Last Solved on" dates, plus live search and a *Hide solved* toggle.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
```

The dev server serves `data/striver_sheet.json` directly from the repo (see the `striver-data`
plugin in `vite.config.ts`), so there's no second copy to maintain.

Run a sync locally:

```bash
pip install -r scripts/requirements.txt
export LEETCODE_USERNAME=your-handle
python scripts/sync.py
```

### Sync modes (important)

LeetCode's public `recentAcSubmissionList` endpoint is **hard-capped at your 20 most
recent accepted submissions** — there is no public way to read your full solved history.
So the sync has two modes:

| Mode | Requires | What it captures |
| --- | --- | --- |
| **Public** | `LEETCODE_USERNAME` only | Only your last 20 solves. Accumulates over time, but can't backfill problems solved before tracking began — so the count starts low. |
| **Full** *(recommended)* | `LEETCODE_SESSION` cookie | Your **complete** solved list (accurate `X / 474` count), plus dates for recent solves. |

To enable Full mode, grab your session cookie and pass it in:

```bash
export LEETCODE_USERNAME=your-handle
export LEETCODE_SESSION='<value of the LEETCODE_SESSION cookie>'
export LEETCODE_CSRF='<value of the csrftoken cookie>'   # optional
python scripts/sync.py
```

> Get the cookie: log in to leetcode.com → DevTools → Application → Cookies →
> copy the `LEETCODE_SESSION` value. It expires periodically; refresh it when the
> count stops updating.

> **Note on dates:** Full mode marks every solved problem complete, but LeetCode only
> exposes dates for recent submissions, so older solves show no "Last Solved on" date
> and won't appear in the heatmap. The heatmap fills in going forward as you keep solving.

Build for production:

```bash
npm run build    # outputs to dist/ (data/ is copied in automatically)
npm run preview
```

## Deployment setup (one-time)

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Actions → General → Workflow permissions: Read and write permissions**
   (lets the sync job commit the updated JSON).
4. Set your handle in `.github/workflows/sync_leetcode.yml` (`LEETCODE_USERNAME`). It currently
   defaults to `mohak47`.
5. *(Recommended)* For an accurate full-history count, add repo secrets
   **Settings → Secrets and variables → Actions**: `LEETCODE_SESSION` (and optionally
   `LEETCODE_CSRF`). Without these the sync runs in Public mode (last 20 solves only).
6. Trigger the **Sync LeetCode Activity** workflow once manually (Actions tab → Run workflow),
   or wait for the 6-hour cron. The **Deploy to GitHub Pages** workflow runs after each sync.

> Your LeetCode profile must be public for `recentAcSubmissionList` to return data.

## Customizing

- **Sync frequency** — edit the `cron` in `sync_leetcode.yml`.
- **Submission window** — set `LEETCODE_LIMIT` (default 20) to fetch more recent solves.
- **Heatmap thresholds / colors** — `src/components/Heatmap.tsx` and `tailwind.config.js`.
