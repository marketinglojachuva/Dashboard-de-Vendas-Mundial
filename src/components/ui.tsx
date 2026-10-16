import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { AdStatus } from '@/lib/analytics'
import { signedPct } from '@/lib/format'

export function Card({ title, subtitle, action, children, className = '' }: {
  title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-surface p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-ink3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** Variação com seta + sinal + cor (nunca só cor). */
export function Delta({ value, goodWhenUp = true, unit = '%', className = '' }: {
  value: number | null; goodWhenUp?: boolean; unit?: '%' | 'pp'; className?: string
}) {
  if (value === null || !Number.isFinite(value)) return null
  const up = value > 0.05, down = value < -0.05
  const good = up ? goodWhenUp : down ? !goodWhenUp : null
  const tone = good === null ? 'text-ink2 bg-surface2' : good ? 'text-good bg-goodbg' : 'text-bad bg-badbg'
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  const txt = unit === 'pp' ? `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1).replace('.', ',')} p.p.` : signedPct(value)
  return (
    <span className={`tnum inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tone} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {txt}
    </span>
  )
}

const STATUS: Record<AdStatus, { label: string; cls: string } | null> = {
  drop: { label: 'Em queda', cls: 'text-bad bg-badbg' },
  stopped: { label: 'Parou de vender', cls: 'text-bad bg-badbg' },
  rise: { label: 'Em alta', cls: 'text-good bg-goodbg' },
  new: { label: 'Novo', cls: 'text-info bg-infobg' },
  stable: { label: 'Estável', cls: 'text-ink2 bg-surface2' },
  none: null,
}

export function StatusTag({ status }: { status: AdStatus }) {
  const s = STATUS[status]
  if (!s) return null
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'info' }) {
  const cls = tone === 'warn' ? 'text-warn bg-warnbg' : tone === 'info' ? 'text-info bg-infobg' : 'text-ink2 bg-surface2'
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}

export function Button({ children, onClick, variant = 'secondary', className = '', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; className?: string; disabled?: boolean; type?: 'button' | 'submit'
}) {
  const v = {
    primary: 'bg-cur text-white hover:opacity-90',
    secondary: 'border border-line2 bg-surface text-ink hover:bg-surface2',
    ghost: 'text-ink2 hover:bg-surface2',
    danger: 'border border-line2 text-bad hover:bg-badbg',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line px-2 py-1 text-xs font-medium text-ink2 transition hover:border-line2 hover:bg-surface2">
      {children}
    </a>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-surface2 px-4 py-6 text-center text-sm text-ink3">{children}</p>
}
