import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ImportRecord } from '@/lib/types'
import { dailySeries } from '@/lib/analytics'
import { brl, dayMonth, int } from '@/lib/format'

type Metric = 'units' | 'gross'

function Tip({ active, payload, metric, curLabel, prevLabel }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  const f = (v?: number) => (v === undefined ? '—' : metric === 'units' ? `${int(v)} un.` : brl(v))
  return (
    <div className="rounded-lg border border-line2 bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="space-y-1">
        {d.curDate && (
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded bg-cur" />
            <span className="tnum text-sm font-semibold text-ink">{f(d.c)}</span>
            <span className="text-ink3">{dayMonth(d.curDate)} · {curLabel}</span>
          </div>
        )}
        {d.prevDate && (
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded bg-prev" />
            <span className="tnum text-sm font-semibold text-ink">{f(d.p)}</span>
            <span className="text-ink3">{dayMonth(d.prevDate)} · {prevLabel}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DailyChart({ cur, prev }: { cur: ImportRecord; prev: ImportRecord | null }) {
  const partialLast = !!cur.exportedAt && cur.exportedAt.slice(0, 10) === cur.periodEnd && cur.exportedAt.slice(11, 13) < '20'
  const [metric, setMetric] = useState<Metric>('gross')
  const data = useMemo(
    () => dailySeries(cur, prev).map((p) => ({
      i: p.i, curDate: p.curDate, prevDate: p.prevDate,
      label: p.curDate ? dayMonth(p.curDate) : `Dia ${p.i + 1}`,
      c: p.cur?.[metric], p: p.prev?.[metric],
    })),
    [cur, prev, metric],
  )
  const [showTable, setShowTable] = useState(false)
  const last = data.findLast((d) => d.c !== undefined)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[13px] text-ink2">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-cur" />{cur.label}</span>
          {prev && <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-prev" />{prev.label}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Métrica" className="inline-flex rounded-lg border border-line p-0.5 text-[13px]">
            {([['units', 'Unidades'], ['gross', 'Faturamento']] as const).map(([k, l]) => (
              <button key={k} aria-pressed={metric === k} onClick={() => setMetric(k)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${metric === k ? 'bg-ink text-surface' : 'text-ink2 hover:bg-surface2'}`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setShowTable((s) => !s)} className="text-[13px] text-ink3 underline-offset-2 hover:underline">
            {showTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>
      </div>

      {partialLast && <p className="mb-2 text-xs text-ink3">O último dia ({dayMonth(cur.periodEnd)}) está incompleto: o relatório foi gerado às {cur.exportedAt!.slice(11, 16)}.</p>}
      {showTable ? (
        <div className="max-h-[280px] overflow-auto">
          <table className="tnum w-full text-[13px]">
            <thead className="sticky top-0 bg-surface text-left text-ink3">
              <tr><th className="py-1.5 font-medium">Dia</th><th className="font-medium">Atual</th>{prev && <><th className="font-medium">Dia (comp.)</th><th className="font-medium">Comparação</th></>}</tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.i} className="border-t border-line">
                  <td className="py-1.5">{d.curDate ? dayMonth(d.curDate) : '—'}</td>
                  <td>{d.c === undefined ? '—' : metric === 'units' ? int(d.c) : brl(d.c)}</td>
                  {prev && <><td>{d.prevDate ? dayMonth(d.prevDate) : '—'}</td><td>{d.p === undefined ? '—' : metric === 'units' ? int(d.p) : brl(d.p)}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[280px] w-full" role="img" aria-label="Gráfico de vendas por dia, período atual contra comparação">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} strokeDasharray="3 6" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={metric === 'gross' ? 56 : 36} tick={{ fill: 'var(--ink-3)', fontSize: 12 }}
                tickFormatter={(v: number) => (metric === 'gross' && v >= 1000 ? `${v / 1000}K` : String(v))} />
              <Tooltip cursor={{ stroke: 'var(--line-strong)' }} content={(p) => <Tip {...p} metric={metric} curLabel={cur.label} prevLabel={prev?.label} />} />
              {prev && <Line type="linear" dataKey="p" stroke="var(--series-prev)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false}
                activeDot={{ r: 5, fill: 'var(--series-prev)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />}
              <Line type="linear" dataKey="c" stroke="var(--series-cur)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
                dot={(p: any) => p.index === data.indexOf(last!)
                  ? <circle key={p.key} cx={p.cx} cy={p.cy} r={5} fill="var(--series-cur)" stroke="var(--surface)" strokeWidth={2} />
                  : <g key={p.key} />}
                activeDot={{ r: 5, fill: 'var(--series-cur)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
