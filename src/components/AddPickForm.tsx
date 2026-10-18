"use client";

import { useActionState } from "react";
import { addPick, type ActionState } from "@/app/actions";
import { SELECTION_LABEL } from "@/lib/format";

export function AddPickForm({
  tipsters,
  fixtures,
}: {
  tipsters: { id: number; name: string }[];
  fixtures: { id: number; label: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(addPick, null);
  if (!tipsters.length) return <p className="text-sm text-muted">Adicione primeiro um tipster.</p>;
  if (!fixtures.length) return <p className="text-sm text-muted">Não há jogos por começar. Carregue em Atualizar na página Hoje.</p>;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="tipsterId">Tipster</label>
        <select id="tipsterId" name="tipsterId" className="input">
          {tipsters.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="fixtureId">Jogo</label>
        <select id="fixtureId" name="fixtureId" className="input">
          {fixtures.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="selection">Aposta</label>
        <select id="selection" name="selection" className="input">
          {Object.entries(SELECTION_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="odds">Odd (opcional)</label>
          <input id="odds" name="odds" className="input" placeholder="auto" inputMode="decimal" />
        </div>
        <div>
          <label className="label" htmlFor="units">Unidades</label>
          <input id="units" name="units" className="input" defaultValue="1" inputMode="decimal" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="reasoning">Nota (opcional)</label>
        <input id="reasoning" name="reasoning" className="input" placeholder="Ex.: publicado no Telegram às 10h" />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn" disabled={pending}>Registar aposta</button>
        {state && <span className={`text-sm ${state.ok ? "text-good" : "text-bad"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
