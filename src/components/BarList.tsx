import type { ReactNode } from 'react'

export interface BarItem {
  key: string
  label: string
  sub?: string
  value: number
  prev?: number | null
  valueLabel: string
  right?: ReactNode
  tooltip?: string
}

/** Lista de barras horizontais em HTML: o rótulo nunca é cortado pela barra. */
export function BarList({ items, showPrev = false }: { items: BarItem[]; showPrev?: boolean }) {
  const max = Math.max(1, ...items.map((i) => Math.max(i.value, i.prev ?? 0)))
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.key} title={i.tooltip}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] text-ink" title={i.label}>{i.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="tnum text-[13px] font-semibold text-ink">{i.valueLabel}</span>
              {i.right}
            </span>
          </div>
          <div className="space-y-[2px]" aria-hidden>
            <div className="h-2 rounded-r-[4px] bg-cur" style={{ width: `${Math.max(1.5, (i.value / max) * 100)}%` }} />
            {showPrev && (
              <div className="h-1 rounded-r-[3px] bg-prev" style={{ width: `${Math.max(i.prev ? 1.5 : 0, ((i.prev ?? 0) / max) * 100)}%` }} />
            )}
          </div>
          {i.sub && <p className="mt-0.5 text-xs text-ink3">{i.sub}</p>}
        </li>
      ))}
    </ul>
  )
}
