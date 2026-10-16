import type { ReactNode } from 'react'
import { Megaphone, TrendingDown, TrendingUp, PackageX } from 'lucide-react'
import { dropClues, type ActionPlan as Plan, type AdRow } from '@/lib/analytics'
import { brl, brl0, competitorsUrl, int, listingUrl, pct, signedBrl0 } from '@/lib/format'
import { Card, Delta, EmptyNote, ExternalLink, Tag } from './ui'

function Item({ r, children, right }: { r: AdRow; children?: ReactNode; right: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink" title={r.title}>{r.title}</p>
        <p className="mt-0.5 text-xs text-ink3">MLB{r.adId.replace(/\D/g, '')}{r.sku ? ` · SKU ${r.sku}` : ''} · preço médio {brl(r.curPrice || r.prevPrice || 0)}</p>
        {children}
        <div className="mt-2 flex gap-1.5">
          <ExternalLink href={competitorsUrl(r.title)}>Ver quem está em 1º</ExternalLink>
          <ExternalLink href={listingUrl(r.adId)}>Abrir anúncio</ExternalLink>
        </div>
      </div>
      <div className="shrink-0 sm:text-right">{right}</div>
    </li>
  )
}

function Section({ icon: Icon, title, hint, count, children, tone }: { icon: typeof TrendingDown; title: string; hint: string; count: number; children: ReactNode; tone: string }) {
  return (
    <Card title={<span className="flex items-center gap-2"><Icon className={`h-4 w-4 ${tone}`} aria-hidden />{title} <span className="tnum rounded-full bg-surface2 px-2 text-xs font-semibold text-ink2">{count}</span></span>} subtitle={hint}>
      {children}
    </Card>
  )
}

export default function ActionPlan({ plan, hasPrev }: { plan: Plan; hasPrev: boolean }) {
  return (
    <div className="space-y-5">
      {!hasPrev && <EmptyNote>Para ver quedas e paradas, complete a cobertura do intervalo anterior. As sugestões de publicidade abaixo funcionam mesmo sem comparação.</EmptyNote>}

      {hasPrev && (
        <>
          <Section icon={TrendingDown} tone="text-bad" title="Quedas relevantes" count={plan.drops.length}
            hint="Ordenados por quanto faturamento deixaram de gerar. As pistas indicam por onde começar a investigar.">
            {plan.drops.length === 0 ? <EmptyNote>Nenhuma queda relevante neste comparativo.</EmptyNote> : (
              <ul className="divide-y divide-line">
                {plan.drops.slice(0, 15).map((r) => (
                  <Item key={r.adId} r={r}
                    right={<><p className="tnum text-base font-bold text-bad">{signedBrl0(r.revenueDelta ?? 0)}</p><p className="tnum text-xs text-ink3">{r.prev!.units} → {r.cur.units} un. ({r.unitsDelta! > 0 ? '+' : ''}{r.unitsDelta} un.)</p><Delta value={r.changePct} className="mt-1" /></>}>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">{dropClues(r).map((c) => <Tag key={c} tone={c.startsWith('Sem pub') || c.startsWith('Preço subiu') ? 'warn' : 'neutral'}>{c}</Tag>)}</div>
                  </Item>
                ))}
              </ul>
            )}
          </Section>

          <Section icon={PackageX} tone="text-bad" title="Pararam de vender" count={plan.stopped.length}
            hint="Venderam 2 ou mais unidades antes e zeraram agora. Confira estoque, pausa, preço e posição.">
            {plan.stopped.length === 0 ? <EmptyNote>Nenhum anúncio zerou.</EmptyNote> : (
              <ul className="divide-y divide-line">
                {plan.stopped.slice(0, 15).map((r) => (
                  <Item key={r.adId} r={r} right={<><p className="tnum text-base font-bold text-bad">{signedBrl0(r.revenueDelta ?? 0)}</p><p className="tnum text-xs text-ink3">{r.prev!.units} → 0 un. ({r.unitsDelta} un.)</p></>} />
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Section icon={Megaphone} tone="text-cur" title="Bons candidatos a patrocinar" count={plan.sponsorCandidates.length}
        hint="Já vendem bem (3 ou mais unidades), quase não usam publicidade e deixam boa proporção de líquido sobre bruto. Não considera o seu custo do produto.">
        {plan.sponsorCandidates.length === 0 ? <EmptyNote>Nenhum anúncio atende a esses critérios agora.</EmptyNote> : (
          <ul className="divide-y divide-line">
            {plan.sponsorCandidates.slice(0, 12).map((r) => (
              <Item key={r.adId} r={r} right={<><p className="tnum text-base font-bold text-ink">{brl0(r.cur.gross)}</p><p className="tnum text-xs text-ink3">{int(r.cur.units)} vendas · {pct(r.sponsoredShare * 100)} por publicidade</p><p className="tnum text-xs text-ink3">líquido / bruto {pct(r.margin * 100)}</p></>} />
            ))}
          </ul>
        )}
      </Section>

      {hasPrev && (
        <Section icon={TrendingUp} tone="text-good" title="Em alta" count={plan.rises.length} hint="Estão vendendo mais do que antes. Garanta estoque e considere reforçar.">
          {plan.rises.length === 0 ? <EmptyNote>Nenhum anúncio com alta relevante.</EmptyNote> : (
            <ul className="divide-y divide-line">
              {plan.rises.slice(0, 10).map((r) => (
                <Item key={r.adId} r={r} right={<><p className="tnum text-base font-bold text-good">{signedBrl0(r.revenueDelta ?? 0)}</p><p className="tnum text-xs text-ink3">{r.prev!.units} → {r.cur.units} un. ({r.unitsDelta! > 0 ? '+' : ''}{r.unitsDelta} un.)</p><Delta value={r.changePct} className="mt-1" /></>} />
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  )
}
