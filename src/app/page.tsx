import { prisma, getSettings } from "@/lib/db";
import { dayKey, dayRange } from "@/lib/dates";
import { tipsterStats } from "@/lib/stats";
import { leagueFlag } from "@/lib/leagues";
import { MARKET_LABEL, SELECTION_LABEL, capitalize, longDate, money, moneySigned, odds, pct, pctSigned, time } from "@/lib/format";
import { evaluateFixture } from "@/lib/model";
import { RefreshButton } from "@/components/RefreshButton";
import { Confidence, Empty, KindTag, Stat, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
// The "Atualizar" button runs the daily job from this page, which can take a few minutes.
export const maxDuration = 300;

export default async function Today() {
  const day = dayKey();
  const { start, end } = dayRange(day);
  const settings = await getSettings();

  const [fixtures, summary, acca, stats30, lastRun] = await Promise.all([
    prisma.fixture.findMany({
      where: { date: { gte: start, lte: end } },
      include: { picks: { include: { tipster: true }, orderBy: { id: "asc" } } },
      orderBy: [{ date: "asc" }],
    }),
    prisma.runLog.findFirst({ where: { day, source: { startsWith: "summary:" } }, orderBy: { id: "desc" } }),
    prisma.accumulator.findFirst({
      where: { day },
      orderBy: { id: "desc" },
      include: { legs: { include: { pick: { include: { fixture: true } } } } },
    }),
    tipsterStats(30),
    prisma.runLog.findFirst({ where: { source: { in: ["api", "mock"] } }, orderBy: { id: "desc" } }),
  ]);
  const todays = fixtures.filter((f) => dayKey(f.date) === day);
  const statsById = new Map(stats30.map((s) => [s.id, s]));

  const allPicks = todays.flatMap((f) => f.picks.map((p) => ({ ...p, fixture: f })));
  const aiPicks = allPicks.filter((p) => p.tipster.kind === "AI").sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const modelPicks = allPicks.filter((p) => p.tipster.kind === "MODEL").sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const ourStake = [...aiPicks].reduce((a, p) => a + p.stake, 0);
  const ai30 = stats30.filter((s) => s.kind === "AI");
  const aiProfit = ai30.reduce((a, s) => a + s.profit, 0);
  const aiStaked = ai30.reduce((a, s) => a + s.staked, 0);
  const isMock = todays.some((f) => f.id < 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{capitalize(longDate(new Date()))}</h1>
          <p className="text-sm text-muted">
            {todays.length} jogos analisados
            {lastRun && <> · última atualização {time(lastRun.createdAt)}</>}
            {isMock && <span className="ml-2 rounded bg-warn-soft px-1.5 py-0.5 text-xs font-medium text-warn">dados simulados</span>}
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Recomendações IA hoje" value={String(aiPicks.length)} sub={`stake total ${money(ourStake)}`} />
        <Stat label="Lucro IA (30 dias)" value={moneySigned(aiProfit)} tone={aiProfit >= 0 ? "good" : "bad"} sub={`em ${money(aiStaked)} apostados`} />
        <Stat label="ROI IA (30 dias)" value={pctSigned(aiStaked ? aiProfit / aiStaked : null)} tone={aiProfit >= 0 ? "good" : "bad"} />
        <Stat label="Banca" value={money(settings.bankroll)} sub={`Kelly ×${settings.kellyFraction} · máx. ${pct(settings.maxStakePct, 0)}/aposta`} />
      </div>

      {todays.length === 0 ? (
        <Empty>Ainda não há jogos para hoje. Carregue em <b>Atualizar</b> para gerar as recomendações.</Empty>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Escolhas da IA</h2>
              {aiPicks[0] && <span className="text-xs text-faint">{aiPicks[0].tipster.name}</span>}
            </div>
            {summary && <p className="card text-sm leading-relaxed text-muted">{summary.message}</p>}
            {aiPicks.length === 0 ? (
              <Empty>Sem apostas com valor hoje. Às vezes a melhor aposta é não apostar.</Empty>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {aiPicks.map((p) => {
                  const others = p.fixture.picks.filter((o) => o.tipsterId !== p.tipsterId && o.selection === p.selection);
                  return (
                    <article key={p.id} className="card flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs text-faint">
                            {leagueFlag(p.fixture.leagueId)} {p.fixture.leagueName} · {time(p.fixture.date)}
                          </div>
                          <div className="font-medium">
                            {p.fixture.homeTeam} <span className="text-faint">vs</span> {p.fixture.awayTeam}
                          </div>
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="flex items-end justify-between rounded-lg bg-surface-2 px-3 py-2">
                        <div>
                          <div className="text-xs text-muted">{MARKET_LABEL[p.market]}</div>
                          <div className="font-semibold">{SELECTION_LABEL[p.selection]}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-semibold">{odds(p.odds)}</div>
                          <div className="text-xs text-muted">stake {money(p.stake)}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span>
                          Prob. {pct(p.probability, 0)} · edge <span className={(p.edge ?? 0) > 0 ? "text-good" : ""}>{pctSigned(p.edge)}</span>
                        </span>
                        <Confidence value={p.confidence} />
                      </div>
                      {p.reasoning && <p className="text-sm leading-snug">{p.reasoning}</p>}
                      {others.length > 0 && (
                        <div className="flex flex-wrap gap-1 text-xs text-muted">
                          Também escolhido por:
                          {others.map((o) => (
                            <span key={o.id} className="rounded bg-accent-soft px-1.5 text-accent">
                              {o.tipster.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {acca && (
            <section className="card">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">Múltipla do dia</h2>
                <div className="flex items-center gap-3 text-sm">
                  <span>
                    Odd total <b className="text-lg">{odds(acca.odds)}</b>
                  </span>
                  <span className="text-muted">stake {money(acca.stake)}</span>
                  <StatusBadge status={acca.status} />
                </div>
              </div>
              <ul className="grid gap-2 md:grid-cols-3">
                {acca.legs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span>
                      <span className="block text-xs text-faint">
                        {l.pick.fixture.homeTeam} vs {l.pick.fixture.awayTeam}
                      </span>
                      {SELECTION_LABEL[l.pick.selection]}
                    </span>
                    <b>{odds(l.pick.odds)}</b>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Apostas de valor do modelo</h2>
            {modelPicks.length === 0 ? (
              <Empty>O modelo não encontrou valor acima de {pct(settings.minEdge, 0)} hoje.</Empty>
            ) : (
              <div className="card overflow-x-auto p-0">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Jogo</th>
                      <th>Aposta</th>
                      <th className="text-right">Odd</th>
                      <th className="text-right">Prob.</th>
                      <th className="text-right">Edge</th>
                      <th className="text-right">Stake</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelPicks.map((p) => (
                      <tr key={p.id}>
                        <td className="text-muted">{time(p.fixture.date)}</td>
                        <td>
                          {p.fixture.homeTeam} – {p.fixture.awayTeam}
                          <div className="text-xs text-faint">{p.fixture.leagueName}</div>
                        </td>
                        <td>{SELECTION_LABEL[p.selection]}</td>
                        <td className="text-right font-medium">{odds(p.odds)}</td>
                        <td className="text-right">{pct(p.probability, 0)}</td>
                        <td className="text-right text-good">{pctSigned(p.edge)}</td>
                        <td className="text-right">{money(p.stake)}</td>
                        <td>
                          <StatusBadge status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Todos os jogos</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {todays.map((f) => {
                const probs = f.xgHome != null && f.xgAway != null ? evaluateFixture(f.xgHome, f.xgAway, f) : [];
                const p = (s: string) => probs.find((o) => o.selection === s)?.probability;
                const finished = f.homeGoals != null && f.awayGoals != null;
                return (
                  <article key={f.id} className="card space-y-3">
                    <div className="flex items-center justify-between text-xs text-faint">
                      <span>
                        {leagueFlag(f.leagueId)} {f.leagueName}
                      </span>
                      <span>{finished ? `Final ${f.homeGoals}–${f.awayGoals}` : time(f.date)}</span>
                    </div>
                    <div className="flex items-center justify-between font-medium">
                      <span>{f.homeTeam}</span>
                      {f.xgHome != null && (
                        <span className="text-xs font-normal text-faint">
                          xG {f.xgHome.toFixed(1)} – {f.xgAway?.toFixed(1)}
                        </span>
                      )}
                      <span>{f.awayTeam}</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {[
                        ["1", f.oddsHome, p("HOME")],
                        ["X", f.oddsDraw, p("DRAW")],
                        ["2", f.oddsAway, p("AWAY")],
                        ["+2,5", f.oddsOver25, p("OVER")],
                        ["-2,5", f.oddsUnder25, p("UNDER")],
                        ["AM", f.oddsBttsYes, p("YES")],
                        ["Ñ AM", f.oddsBttsNo, p("NO")],
                      ].map(([label, o, prob]) => (
                        <div key={label as string} className="rounded-md bg-surface-2 py-1">
                          <div className="text-faint">{label as string}</div>
                          <div className="font-semibold">{odds(o as number | null)}</div>
                          <div className="text-[10px] text-muted">{prob != null ? pct(prob as number, 0) : "—"}</div>
                        </div>
                      ))}
                    </div>
                    {f.picks.length > 0 && (
                      <ul className="space-y-1 text-xs">
                        {f.picks.map((pk) => {
                          const s = statsById.get(pk.tipsterId);
                          return (
                            <li key={pk.id} className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <KindTag kind={pk.tipster.kind} />
                                {pk.tipster.name}
                                {s?.roi != null && s.settled >= 10 && (
                                  <span className={s.roi >= 0 ? "text-good" : "text-bad"} title="ROI 30 dias">
                                    {pctSigned(s.roi, 0)}
                                  </span>
                                )}
                              </span>
                              <span className="font-medium">
                                {SELECTION_LABEL[pk.selection]} @ {odds(pk.odds)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
