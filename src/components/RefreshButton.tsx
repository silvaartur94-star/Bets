"use client";

import { useActionState } from "react";
import { refreshAction, type ActionState } from "@/app/actions";

export function RefreshButton() {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(refreshAction, null);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button name="refetch" value="1" className="btn-ghost" disabled={pending} title="Volta a descarregar jogos e odds (gasta pedidos da API)">
          Descarregar odds
        </button>
        <button className="btn" disabled={pending}>
          {pending ? "A atualizar…" : "Atualizar"}
        </button>
      </div>
      {state && <p className={`text-xs ${state.ok ? "text-muted" : "text-bad"}`}>{state.message}</p>}
    </form>
  );
}
