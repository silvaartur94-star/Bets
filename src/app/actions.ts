"use server";

import { revalidatePath } from "next/cache";
import { prisma, getSettings } from "@/lib/db";
import { runDaily } from "@/lib/pipeline";
import { marketOf, oddsFor, type Selection } from "@/lib/model";

export interface ActionState {
  ok: boolean;
  message: string;
}

function refreshAll() {
  for (const p of ["/", "/historico", "/tipsters", "/definicoes"]) revalidatePath(p);
}

export async function refreshAction(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  try {
    const r = await runDaily({ refetch: form.get("refetch") === "1" });
    refreshAll();
    const engine = r.aiEngine === "claude" ? "Claude" : "heurística";
    return {
      ok: true,
      message: `${r.fixtures} jogos · ${r.picks} apostas · ${r.settled} resolvidas · IA: ${engine}${r.source === "mock" ? " · dados simulados" : ` · ${r.apiRequests} pedidos API`}${r.warnings.length ? ` · ${r.warnings.length} avisos` : ""}`,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function addTipster(form: FormData) {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return;
  await prisma.tipster.upsert({
    where: { name },
    update: {},
    create: { name, kind: "HUMAN", url: String(form.get("url") ?? "").trim() || null, notes: String(form.get("notes") ?? "").trim() || null },
  });
  refreshAll();
}

export async function deleteTipster(form: FormData) {
  const id = Number(form.get("id"));
  await prisma.tipster.deleteMany({ where: { id, kind: "HUMAN" } });
  refreshAll();
}

export async function addPick(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const tipsterId = Number(form.get("tipsterId"));
  const fixtureId = Number(form.get("fixtureId"));
  const selection = String(form.get("selection")) as Selection;
  const units = Number(form.get("units") || 1);
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture || !tipsterId) return { ok: false, message: "Escolha um tipster e um jogo." };
  const odds = Number(String(form.get("odds") || "").replace(",", ".")) || oddsFor(fixture, selection);
  if (!odds || odds <= 1) return { ok: false, message: "Sem odd disponível: indique a odd manualmente." };
  const settings = await getSettings();
  const market = marketOf(selection);
  await prisma.pick.upsert({
    where: { fixtureId_tipsterId_market_selection: { fixtureId, tipsterId, market, selection } },
    update: { odds, stake: units * settings.bankroll * 0.01 },
    create: {
      fixtureId,
      tipsterId,
      market,
      selection,
      odds,
      stake: Math.round(units * settings.bankroll * 0.01 * 2) / 2,
      reasoning: String(form.get("reasoning") ?? "").trim() || null,
    },
  });
  refreshAll();
  return { ok: true, message: "Aposta registada." };
}

export async function deletePick(form: FormData) {
  await prisma.pick.deleteMany({ where: { id: Number(form.get("id")), status: "PENDING" } });
  refreshAll();
}

export async function saveSettings(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const num = (k: string, scale = 1) => Number(String(form.get(k)).replace(",", ".")) / scale;
  const leagues = form.get("allLeagues") === "on" ? "ALL" : form.getAll("league").join(",");
  const data = {
    bankroll: num("bankroll"),
    kellyFraction: num("kellyFraction"),
    maxStakePct: num("maxStakePct", 100),
    minEdge: num("minEdge", 100),
    minOdds: num("minOdds"),
    maxOdds: num("maxOdds"),
    maxFixtures: Math.round(num("maxFixtures")),
    leagues,
  };
  if (Object.values(data).some((v) => typeof v === "number" && (!Number.isFinite(v) || v < 0))) {
    return { ok: false, message: "Valores inválidos." };
  }
  if (!leagues) return { ok: false, message: "Escolha pelo menos uma liga." };
  await prisma.settings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  refreshAll();
  return { ok: true, message: "Definições guardadas. Carregue em Atualizar para recalcular as apostas de hoje." };
}

export async function clearDemoData() {
  await prisma.accumulator.deleteMany({ where: { legs: { some: { pick: { fixtureId: { lt: 0 } } } } } });
  await prisma.fixture.deleteMany({ where: { id: { lt: 0 } } });
  await prisma.runLog.deleteMany({ where: { source: "mock" } });
  refreshAll();
}
