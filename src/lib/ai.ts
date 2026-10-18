// AI analyst: Claude reviews the model's value bets alongside the provider and
// tipster picks, and returns a short, selective list with reasoning.
import Anthropic from "@anthropic-ai/sdk";
import type { Outcome, Selection } from "./model";

export interface Candidate {
  fixtureId: number;
  match: string;
  league: string;
  kickoff: string;
  xg: { home: number; away: number } | null;
  form: { home: string | null; away: string | null };
  outcomes: Outcome[];
  tipsterPicks: { tipster: string; kind: string; selection: Selection; hitRate: number | null; roi: number | null; settled: number }[];
}

export interface AiPick {
  fixtureId: number;
  selection: Selection;
  probability: number;
  confidence: number;
  reasoning: string;
}

export interface AiResult {
  engine: "claude" | "heuristic";
  summary: string;
  picks: AiPick[];
}

const SELECTIONS: Selection[] = ["HOME", "DRAW", "AWAY", "OVER", "UNDER", "YES", "NO"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "picks"],
  properties: {
    summary: { type: "string", description: "Resumo do dia em 2-3 frases, em português de Portugal." },
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fixtureId", "selection", "probability", "confidence", "reasoning"],
        properties: {
          fixtureId: { type: "integer" },
          selection: { type: "string", enum: SELECTIONS },
          probability: { type: "number", description: "Probabilidade estimada (0 a 1)." },
          confidence: { type: "integer", description: "Confiança de 1 (baixa) a 5 (alta)." },
          reasoning: { type: "string", description: "Justificação em 1-2 frases, português de Portugal." },
        },
      },
    },
  },
} as const;

const SYSTEM = `És um analista de apostas desportivas focado em valor a longo prazo, não em palpites populares.

Recebes os jogos do dia com: probabilidades e edge de um modelo Poisson (já misturado com as odds do mercado sem margem), xG estimado, forma recente, e as escolhas de tipsters com o seu histórico (taxa de acerto, ROI e número de apostas resolvidas).

Regras:
- Escolhe no máximo 6 apostas, só entre os resultados listados em "outcomes" (mercados 1X2, OU25 = mais/menos 2,5 golos, BTTS = ambas marcam).
- No máximo uma aposta por jogo.
- Só recomendas uma aposta se a tua probabilidade vezes a odd for maior que 1 (valor positivo). Se nada tiver valor, devolve uma lista vazia.
- Dá peso ao consenso de tipsters com histórico comprovado (muitas apostas resolvidas e ROI positivo); ignora tipsters com amostras pequenas.
- Sê conservador: a tua probabilidade não deve afastar-se mais de 8 pontos percentuais da do modelo sem uma razão concreta.
- Escreve o resumo e as justificações em português de Portugal, de forma direta.`;

export async function analyseWithClaude(candidates: Candidate[]): Promise<AiResult> {
  const client = new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `Jogos de hoje (JSON):\n${JSON.stringify(candidates)}` }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude recusou o pedido");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Resposta do Claude sem texto");
  const parsed = JSON.parse(text.text) as { summary: string; picks: AiPick[] };
  return { engine: "claude", summary: parsed.summary, picks: validate(parsed.picks, candidates) };
}

/** Drop picks that don't match a priced candidate, duplicate a fixture, or lack value. */
function validate(picks: AiPick[], candidates: Candidate[]): AiPick[] {
  const seen = new Set<number>();
  const out: AiPick[] = [];
  for (const p of picks) {
    const c = candidates.find((c) => c.fixtureId === p.fixtureId);
    const o = c?.outcomes.find((o) => o.selection === p.selection);
    if (!c || !o || seen.has(p.fixtureId)) continue;
    const probability = Math.min(0.97, Math.max(0.02, p.probability));
    if (probability * o.odds <= 1) continue;
    seen.add(p.fixtureId);
    out.push({ ...p, probability, confidence: Math.min(5, Math.max(1, Math.round(p.confidence))) });
  }
  return out.slice(0, 6);
}

const SELECTION_TEXT: Record<Selection, string> = {
  HOME: "vitória da casa",
  DRAW: "empate",
  AWAY: "vitória fora",
  OVER: "mais de 2,5 golos",
  UNDER: "menos de 2,5 golos",
  YES: "ambas marcam",
  NO: "nem ambas marcam",
};

/** Rule-based stand-in when no Anthropic key is configured. */
export function analyseHeuristically(candidates: Candidate[], minEdge: number, minOdds: number, maxOdds: number): AiResult {
  const scored = candidates.flatMap((c) =>
    c.outcomes
      .filter((o) => o.edge >= minEdge && o.odds >= minOdds && o.odds <= maxOdds)
      .map((o) => {
        const backers = c.tipsterPicks.filter((t) => t.selection === o.selection);
        const proven = backers.filter((t) => t.settled >= 20 && (t.roi ?? 0) > 0).length;
        const score = o.edge + 0.02 * backers.length + 0.03 * proven;
        return { c, o, backers, score };
      }),
  );
  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<number>();
  const picks: AiPick[] = [];
  for (const s of scored) {
    if (seen.has(s.c.fixtureId) || picks.length >= 5) continue;
    seen.add(s.c.fixtureId);
    const backing = s.backers.length ? ` Apoiado por: ${s.backers.map((b) => b.tipster).join(", ")}.` : "";
    picks.push({
      fixtureId: s.c.fixtureId,
      selection: s.o.selection,
      probability: s.o.probability,
      confidence: Math.min(5, 1 + Math.round(s.score * 20)),
      reasoning: `O modelo dá ${(s.o.probability * 100).toFixed(0)}% para ${SELECTION_TEXT[s.o.selection]} contra ${(100 / s.o.odds).toFixed(0)}% implícitos na odd ${s.o.odds.toFixed(2)} (edge ${(s.o.edge * 100).toFixed(1)}%).${backing}`,
    });
  }
  const summary = picks.length
    ? `${picks.length} apostas com valor encontradas em ${candidates.length} jogos. Análise heurística: configure ANTHROPIC_API_KEY para ter a análise do Claude.`
    : `Nenhuma aposta com valor suficiente em ${candidates.length} jogos hoje.`;
  return { engine: "heuristic", summary, picks };
}
