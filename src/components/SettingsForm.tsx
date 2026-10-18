"use client";

import { useActionState } from "react";
import { saveSettings, type ActionState } from "@/app/actions";

interface Props {
  settings: {
    bankroll: number;
    kellyFraction: number;
    maxStakePct: number;
    minEdge: number;
    minOdds: number;
    maxOdds: number;
    maxFixtures: number;
    leagues: string;
  };
  leagues: { id: number; name: string; country: string; flag: string }[];
}

export function SettingsForm({ settings, leagues }: Props) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(saveSettings, null);
  const all = settings.leagues === "ALL";
  const selected = new Set(settings.leagues.split(",").map(Number));
  const field = (name: string, label: string, value: number, hint?: string) => (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} defaultValue={value} className="input" inputMode="decimal" />
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
  return (
    <form action={action} className="space-y-6">
      <section className="card space-y-4">
        <h2 className="font-semibold">Banca e stakes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {field("bankroll", "Banca (€)", settings.bankroll)}
          {field("kellyFraction", "Fração de Kelly", settings.kellyFraction, "0,25 = quarter-Kelly (recomendado)")}
          {field("maxStakePct", "Stake máx. por aposta (%)", +(settings.maxStakePct * 100).toFixed(2))}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Filtros de valor</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {field("minEdge", "Edge mínimo (%)", +(settings.minEdge * 100).toFixed(2), "Vantagem mínima sobre a odd")}
          {field("minOdds", "Odd mínima", settings.minOdds)}
          {field("maxOdds", "Odd máxima", settings.maxOdds)}
          {field("maxFixtures", "Máx. jogos por dia", settings.maxFixtures, "Cada jogo gasta 2 pedidos da API")}
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Ligas</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="allLeagues" defaultChecked={all} />
          Todas as ligas do mundo (prioridade às listadas abaixo, até ao máximo de jogos)
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((l) => (
            <label key={l.id} className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <input type="checkbox" name="league" value={l.id} defaultChecked={all || selected.has(l.id)} />
              <span aria-hidden>{l.flag}</span>
              {l.name}
              <span className="text-xs text-faint">{l.country}</span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn" disabled={pending}>Guardar</button>
        {state && <span className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
