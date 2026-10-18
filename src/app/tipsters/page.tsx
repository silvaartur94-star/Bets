import { prisma } from "@/lib/db";
import { rankScore, tipsterStats } from "@/lib/stats";
import { SELECTION_LABEL, money, moneySigned, odds, pct, pctSigned, shortDate, time } from "@/lib/format";
import { addTipster, deletePick, deleteTipster } from "@/app/actions";
import { AddPickForm } from "@/components/AddPickForm";
import { FormStrip, KindTag } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Tipsters() {
  const [all, last30] = await Promise.all([tipsterStats(), tipsterStats(30)]);
  const roi30 = new Map(last30.map((s) => [s.id, s.roi]));
  const ranked = [...all].sort((a, b) => rankScore(b) - rankScore(a));
  const humans = await prisma.tipster.findMany({ where: { kind: "HUMAN" }, orderBy: { name: "asc" } });
  const upcoming = await prisma.fixture.findMany({
    where: { date: { gt: new Date(), lt: new Date(Date.now() + 3 * 86_400_000) }, status: "NS" },
    orderBy: { date: "asc" },
  });
  const pending = await prisma.pick.findMany({
    where: { status: "PENDING", tipster: { kind: "HUMAN" } },
    include: { tipster: true, fixture: true },
    orderBy: { fixture: { date: "asc" } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tipsters</h1>
        <p className="text-sm text-muted">
          Ranking por ROI ajustado à amostra: um ROI alto em poucas apostas conta menos do que um ROI estável em centenas.
        </p>
      </div>

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Fonte</th>
              <th className="text-right">Apostas</th>
              <th className="text-right">Acerto</th>
              <th className="text-right">Odd média</th>
              <th className="text-right">Lucro</th>
              <th className="text-right">ROI</th>
              <th className="text-right">ROI 30d</th>
              <th>Últimas 10</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((s, i) => (
              <tr key={s.id}>
                <td className="text-muted">{i + 1}</td>
                <td className="whitespace-nowrap">
                  <KindTag kind={s.kind} /> <span className="font-medium">{s.name}</span>
                  {s.pending > 0 && <span className="ml-1 text-xs text-faint">({s.pending} pendentes)</span>}
                </td>
                <td className="text-right">{s.settled}</td>
                <td className="text-right">{pct(s.hitRate, 0)}</td>
                <td className="text-right">{odds(s.avgOdds)}</td>
                <td className={`text-right ${s.profit >= 0 ? "text-good" : "text-bad"}`}>{moneySigned(s.profit)}</td>
                <td className={`text-right font-medium ${(s.roi ?? 0) >= 0 ? "text-good" : "text-bad"}`}>{pctSigned(s.roi)}</td>
                <td className="text-right text-muted">{pctSigned(roi30.get(s.id))}</td>
                <td>
                  <FormStrip results={s.last10} />
                </td>
                <td>
                  {s.kind === "HUMAN" && (
                    <form action={deleteTipster}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-xs text-faint hover:text-bad" title="Apagar tipster e as suas apostas">
                        Apagar
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <section className="card space-y-3">
          <h2 className="font-semibold">Adicionar tipster</h2>
          <form action={addTipster} className="space-y-3">
            <div>
              <label className="label" htmlFor="name">Nome</label>
              <input id="name" name="name" className="input" required placeholder="Ex.: tipster do Telegram" />
            </div>
            <div>
              <label className="label" htmlFor="url">Link (opcional)</label>
              <input id="url" name="url" className="input" placeholder="https://" />
            </div>
            <button className="btn">Adicionar</button>
          </form>
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Registar aposta de um tipster</h2>
          <p className="text-xs text-muted">
            A odd é preenchida com a do mercado se ficar vazia. 1 unidade = 1% da banca. A IA tem em conta estas escolhas na próxima atualização.
          </p>
          <AddPickForm
            tipsters={humans.map((t) => ({ id: t.id, name: t.name }))}
            fixtures={upcoming.map((f) => ({ id: f.id, label: `${shortDate(f.date)} ${time(f.date)} · ${f.homeTeam} – ${f.awayTeam}` }))}
          />
        </section>
      </div>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Apostas pendentes de tipsters</h2>
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <tbody>
                {pending.map((p) => (
                  <tr key={p.id}>
                    <td className="text-muted">{shortDate(p.fixture.date)} {time(p.fixture.date)}</td>
                    <td className="font-medium">{p.tipster.name}</td>
                    <td>{p.fixture.homeTeam} – {p.fixture.awayTeam}</td>
                    <td>{SELECTION_LABEL[p.selection]} @ {odds(p.odds)}</td>
                    <td className="text-right">{money(p.stake)}</td>
                    <td>
                      <form action={deletePick}>
                        <input type="hidden" name="id" value={p.id} />
                        <button className="text-xs text-faint hover:text-bad">Remover</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
