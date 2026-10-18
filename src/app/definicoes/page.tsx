import { prisma, getSettings } from "@/lib/db";
import { LEAGUES } from "@/lib/leagues";
import { time, shortDate } from "@/lib/format";
import { clearDemoData } from "@/app/actions";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, logs, demoCount] = await Promise.all([
    getSettings(),
    prisma.runLog.findMany({ where: { source: { in: ["api", "mock"] } }, orderBy: { id: "desc" }, take: 10 }),
    prisma.fixture.count({ where: { id: { lt: 0 } } }),
  ]);
  const hasFootball = !!process.env.API_FOOTBALL_KEY?.trim();
  const hasClaude = !!process.env.ANTHROPIC_API_KEY?.trim();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Definições</h1>

      <section className="card grid gap-3 sm:grid-cols-2">
        <Key ok={hasFootball} name="API_FOOTBALL_KEY" on="Jogos, odds e previsões reais" off="A usar dados simulados" />
        <Key ok={hasClaude} name="ANTHROPIC_API_KEY" on="Análise pelo Claude" off="A usar o analista heurístico" />
      </section>

      <SettingsForm settings={settings} leagues={LEAGUES} />

      {demoCount > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Dados de demonstração</h2>
            <p className="text-sm text-muted">{demoCount} jogos simulados. Apague-os antes de começar a acompanhar resultados reais.</p>
          </div>
          <form action={clearDemoData}>
            <button className="btn-ghost text-bad">Apagar dados simulados</button>
          </form>
        </section>
      )}

      <section className="card">
        <h2 className="mb-2 font-semibold">Últimas execuções</h2>
        <ul className="space-y-1 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex gap-3">
              <span className="whitespace-nowrap text-faint">
                {shortDate(l.createdAt)} {time(l.createdAt)}
              </span>
              <span className="text-muted">{l.message}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="text-muted">Ainda sem execuções.</li>}
        </ul>
      </section>
    </div>
  );
}

function Key({ ok, name, on, off }: { ok: boolean; name: string; on: string; off: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${ok ? "bg-good-soft text-good" : "bg-warn-soft text-warn"}`} aria-hidden>
        {ok ? "✓" : "!"}
      </span>
      <div>
        <code className="text-xs">{name}</code> {ok ? "configurada" : "em falta"}
        <div className="text-xs text-muted">{ok ? on : off}</div>
      </div>
    </div>
  );
}
