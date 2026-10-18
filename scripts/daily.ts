// Usage:
//   npm run daily                 run today's job (same as the cron route)
//   npm run daily -- --refetch    re-download today's fixtures and odds
//   npm run daily -- --demo 30    fill the last 30 days with mock history
import { runDaily } from "../src/lib/pipeline";
import { dayKey } from "../src/lib/dates";
import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const demo = args.indexOf("--demo");
  if (demo !== -1) {
    const days = Number(args[demo + 1] ?? 30);
    for (let i = days; i >= 1; i--) {
      const day = dayKey(new Date(Date.now() - i * 86_400_000));
      const r = await runDaily({ day, backfill: true });
      console.log(`${day}: ${r.fixtures} jogos, ${r.picks} apostas, ${r.settled} resolvidas`);
    }
  }
  const r = await runDaily({ refetch: args.includes("--refetch") });
  console.log(JSON.stringify(r, null, 2));
}

main().finally(() => prisma.$disconnect());
