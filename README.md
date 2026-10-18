# Apostas do Dia ⚽

A daily football betting dashboard (in Portuguese, amounts in EUR). It combines three kinds of source and tracks how each one performs over time:

| Source | What it does |
|---|---|
| **Value model** | A Poisson model built on estimated xG, blended 50/50 with the bookmaker's odds after removing their margin. It recommends the outcome with the biggest edge in each match. |
| **API-Football predictions** | The data provider's own predictions, tracked as one more tipster. |
| **Your tipsters** | Add the tipsters you follow and record their picks. They are ranked by ROI adjusted for sample size. |
| **AI (Claude)** | Reviews the model, odds, form and tipster consensus, weighted by each tipster's track record. It picks at most 6 bets with written reasoning. Without a key it falls back to a heuristic analyst. |

Markets: 1X2, over/under 2.5 goals, and both teams to score, plus a daily accumulator built from the 3 most likely AI picks. Stakes use **fractional Kelly** (¼ by default, capped at 3% of the bankroll per bet). All bets settle automatically and feed the ROI, hit rate and profit chart for each source.

## Getting started

```bash
npm install
cp .env.example .env        # fill in the keys (optional)
npx prisma db push          # create the SQLite database
npm run daily -- --demo 30  # optional: 30 days of simulated history
npm run dev                 # http://localhost:3000
```

With no keys, the app uses **simulated data** so you can try everything. Before you start tracking for real, delete the simulated data under *Definições* (Settings).

### Keys

- `API_FOOTBALL_KEY`: create a free account at [api-football.com](https://dashboard.api-football.com). The free plan allows **100 requests a day**. Each update costs 1 request for the fixture list, 2 per match (odds and prediction), and 1 for every 20 matches being settled. At the default of 30 matches that comes to about 62 requests. Pressing **Atualizar** (Update) again reuses the fixtures already downloaded. Only **Descarregar odds** (Download odds) spends requests again.
- `ANTHROPIC_API_KEY`: from [console.anthropic.com](https://console.anthropic.com). Each daily analysis is one call to `claude-opus-5-5`, with refusal fallback (`fallbacks: "default"`) turned on.
- `DASHBOARD_PASSWORD`: protects the site with HTTP Basic Auth (any username works).
- `CRON_SECRET`: protects `/api/cron/daily`.

## Daily automation

- **Vercel:** `vercel.json` already schedules `/api/cron/daily` for 08:00 UTC. Set `CRON_SECRET` in the project settings.
- **Any other server:** `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/daily`, or `npm run daily` from cron.

Each run (1) settles finished bets, (2) downloads the day's matches, odds and predictions, (3) generates picks from the model, the AI and the accumulator.

### Deploying to Vercel

SQLite doesn't persist on Vercel. Create a Postgres database (Neon or Supabase), change `provider = "postgresql"` in `prisma/schema.prisma`, set `DATABASE_URL`, and run `npx prisma db push`.

## Structure

```
src/lib/model.ts        Poisson, de-vig, edge, Kelly, settlement
src/lib/apiFootball.ts  API-Football client (fixtures, odds, predictions, results)
src/lib/mock.ts         deterministic simulated data
src/lib/ai.ts           Claude analyst + heuristic fallback
src/lib/pipeline.ts     daily job
src/lib/stats.ts        ROI, hit rate, ranking, profit series
src/app/                pages: Hoje, Histórico, Tipsters, Definições
```

> Statistical recommendations, not guarantees. Only bet what you can afford to lose. 18+.
