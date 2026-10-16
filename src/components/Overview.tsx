import { ArrowRight, TrendingDown, Trophy } from 'lucide-react'
import type { ImportRecord } from '@/lib/types'
import { rateChange, type ActionPlan, type AdRow, type Totals } from '@/lib/analytics'
import { brl, int, signedInt } from '@/lib/format'
import DailyChart from './DailyChart'
import { Card, Delta, EmptyNote } from './ui'

function Kpi({ label, value, delta, sub, alert = false }: {
  label: string; value: string; delta: number | null; sub: string; alert?: boolean
}) {
  return <div className="min-w-0 p-5 sm:p-6">
    <p className="text-sm font-medium text-ink3">{label}</p>
    <p className={`tnum mt-3 text-3xl font-bold tracking-tight ${alert ? 'text-bad' : 'text-ink'}`}>{value}</p>
    <div className="mt-3 flex min-h-6 flex-wrap items-center gap-2"><Delta value={delta} /><span className="text-xs text-ink3">{sub}</span></div>
  </div>
}

export default function Overview({ cur, prev, tc, tp, rows, plan, onGoto }: {
  cur: ImportRecord; prev: ImportRecord | null; tc: Totals; tp: Totals | null; rows: AdRow[]; plan: ActionPlan; onGoto: (tab: string) => void
}) {
  const rc = (a: number, b: number) => tp ? rateChange(a, tc.days, b, tp.days) : null
  const alerts = rows.filter(r => (r.unitsDelta ?? 0) < 0)
  const drops = [...alerts].sort((a,b) => (a.revenueDelta ?? 0) - (b.revenueDelta ?? 0)).slice(0,3)
  const champions = [...rows].filter(r => r.cur.units > 0 && !alerts.includes(r)).sort((a,b) => b.cur.units-a.cur.units).slice(0,2)
  const comparison = tp ? 'vs. período anterior' : 'no período selecionado'
  return <div className="min-w-0 space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-widest text-ink3">{cur.label}</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Como foram suas vendas?</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink2">{tp ? <>Você vendeu <strong>{int(tc.units)} unidades</strong>, {tc.units===tp.units?'a mesma quantidade do intervalo anterior':<><strong>{int(Math.abs(tc.units-tp.units))} {tc.units>tp.units?'a mais':'a menos'}</strong> que antes</>}. O faturamento {tc.gross===tp.gross?'ficou igual':tc.gross>tp.gross?'subiu':'caiu'}{tc.gross!==tp.gross&&<> <strong>{brl(Math.abs(tc.gross-tp.gross))}</strong></>}.</> : 'Veja as vendas do intervalo escolhido. A comparação aparece quando houver histórico anterior completo.'}</p></div>
    <section aria-label="Indicadores executivos" className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
      <Kpi label="Quanto vendeu" value={brl(tc.gross)} delta={rc(tc.gross,tp?.gross ?? 0)} sub={tp ? `Antes: ${brl(tp.gross)}` : comparison} />
      <Kpi label="Quantos itens vendeu" value={int(tc.units)} delta={rc(tc.units,tp?.units ?? 0)} sub={tp ? `Antes: ${int(tp.units)} · ${signedInt(tc.units-tp.units)} un.` : 'sem canceladas e devolvidas'} />
      <Kpi label="Valor médio por venda" value={brl(tc.ticket)} delta={tp?.ticket ? (tc.ticket/tp.ticket-1)*100 : null} sub="por ID de venda válido" />
      <Kpi label="Anúncios que venderam menos" value={prev ? int(alerts.length) : '—'} delta={null} sub={prev ? 'qualquer redução em unidades' : 'adicione uma comparação'} alert={!!prev && alerts.length>0} />
    </section>
    <p className="px-1 text-xs text-ink3">Os resultados consideram vendas não canceladas e sem devolução registrada. Faturamento é o valor dos produtos, antes das tarifas. <button className="font-medium text-cur underline" onClick={()=>onGoto('analises')}>Ver tarifas e valor líquido</button></p>
    {tp && tp.days !== tc.days && <p className="rounded-lg bg-infobg px-4 py-3 text-xs text-info">Períodos de {tc.days} e {tp.days} dias: as variações de faturamento e unidades comparam médias diárias.</p>}
    <Card title="Suas vendas dia a dia" subtitle="A linha azul mostra quanto você vendeu em cada dia. A cinza mostra o intervalo anterior."><DailyChart cur={cur} prev={prev} /></Card>
    <Card title="Quais produtos merecem atenção?" subtitle="As maiores perdas de faturamento aparecem primeiro. As sugestões são pontos para conferir." action={<button onClick={()=>onGoto('plano')} className="inline-flex items-center gap-1 text-sm font-medium text-cur">Plano completo <ArrowRight className="h-4 w-4" /></button>}>
      {!prev && <p className="mb-3 text-sm text-ink3">Selecione um período de comparação para identificar quedas.</p>}
      {!drops.length && !champions.length ? <EmptyNote>Nenhuma prioridade identificada neste período.</EmptyNote> : <ul className="divide-y divide-line">{[...drops.map(r=>({r,drop:true})),...champions.map(r=>({r,drop:false}))].map(({r,drop})=><li key={r.adId} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"><span className={`rounded-lg p-2 ${drop ? 'bg-badbg text-bad' : 'bg-goodbg text-good'}`}>{drop ? <TrendingDown className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={r.title}>{r.title}</p><p className="mt-1 text-sm text-ink3">{drop ? `Vendeu ${r.prev?.units ?? 0} antes e ${r.cur.units} agora. Confira preço e disponibilidade.` : 'Campeão de vendas: confira o estoque para manter o ritmo.'}</p></div><span className={`tnum shrink-0 text-sm font-semibold ${drop?'text-bad':'text-good'}`}>{drop ? `${r.prev?.units ?? 0} → ${r.cur.units} (${r.unitsDelta} un.)` : `${int(r.cur.units)} un.`}</span></li>)}</ul>}
      {plan.stopped.length>0 && <p className="mt-4 text-xs text-ink3">{plan.stopped.length} anúncios venderam pelo menos 2 unidades antes e zeraram agora.</p>}
    </Card>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5"><div><h2 className="font-semibold">Quer conferir produto por produto?</h2><p className="mt-1 text-sm text-ink3">Veja nome, SKU, quantidade antes e agora, e quantas unidades ganhou ou perdeu.</p></div><button onClick={()=>onGoto('anuncios')} className="rounded-lg bg-cur px-4 py-2 text-sm font-semibold text-white">Comparar todos os produtos →</button></div>
  </div>
}
