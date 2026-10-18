import { prisma } from "./db";

export const SYSTEM_TIPSTERS = {
  claude: { name: "Claude IA", kind: "AI", notes: "Análise do Claude sobre o modelo, as odds e o consenso dos tipsters." },
  heuristic: { name: "Analista heurístico", kind: "AI", notes: "Usado quando não há ANTHROPIC_API_KEY: combina valor do modelo com consenso." },
  model: { name: "Modelo de valor", kind: "MODEL", notes: "Poisson com xG estimado, misturado com as odds sem margem." },
  provider: { name: "API-Football Previsões", kind: "API", notes: "Previsões publicadas pelo próprio fornecedor de dados." },
} as const;

export type SystemTipsterKey = keyof typeof SYSTEM_TIPSTERS;

export async function systemTipster(key: SystemTipsterKey) {
  const t = SYSTEM_TIPSTERS[key];
  return prisma.tipster.upsert({ where: { name: t.name }, update: {}, create: t });
}

export const KIND_LABEL: Record<string, string> = {
  AI: "IA",
  MODEL: "Modelo",
  API: "Fornecedor",
  HUMAN: "Tipster",
};
