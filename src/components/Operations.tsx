import { AlertTriangle } from 'lucide-react'
import type { ImportRecord } from '@/lib/types'
import { lostLines, stageCounts } from '@/lib/analytics'
import { brl, brl0, dateTimeBR, int } from '@/lib/format'
import { BarList } from './BarList'
import { Card, EmptyNote, Tag } from './ui'

export default function Operations({ cur }: { cur: ImportRecord }) {
  const stages = stageCounts(cur)
  const nfe = stages.find((s) => s.stage === 'nfe')
  const ship = stages.find((s) => s.stage === 'ship')
  const lost = lostLines(cur)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Situação das vendas" subtitle={`Como cada venda estava quando o relatório foi gerado${cur.exportedAt ? ` (${dateTimeBR(cur.exportedAt)})` : ''}. Não inclui canceladas e devolvidas.`}>
          <BarList items={stages.map((s) => ({ key: s.stage, label: s.label, value: s.orders, valueLabel: `${int(s.orders)} vendas`, sub: brl0(s.gross) }))} />
        </Card>
        <Card title="Pendências" subtitle="O que precisa de ação sua">
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${nfe ? 'text-warn' : 'text-ink3'}`} aria-hidden />
              <span>{nfe ? <><b className="tnum">{int(nfe.orders)}</b> vendas aguardando NF-e ou dados fiscais ({brl0(nfe.gross)}).</> : 'Nenhuma venda aguardando NF-e.'}</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${ship ? 'text-warn' : 'text-ink3'}`} aria-hidden />
              <span>{ship ? <><b className="tnum">{int(ship.orders)}</b> vendas para enviar ou coletar ({brl0(ship.gross)}).</> : 'Nada aguardando envio.'}</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card title={<>Canceladas e devolvidas <span className="tnum rounded-full bg-surface2 px-2 text-xs font-semibold text-ink2">{lost.length}</span></>}
        subtitle="Ficam de fora das vendas e do faturamento do painel. Repetição no mesmo anúncio pode indicar problema de descrição, estoque ou compatibilidade.">
        {lost.length === 0 ? <EmptyNote>Nenhuma venda cancelada ou devolvida neste período.</EmptyNote> : (
          <div className="relative -mx-5 overflow-x-auto">
            <table className="tnum w-full min-w-[720px] text-[13px]">
              <thead className="border-y border-line bg-surface2 text-left text-ink3">
                <tr><th className="py-2 pl-5 pr-3 font-medium">Anúncio</th><th className="px-3 font-medium">Situação</th><th className="px-3 font-medium">Data</th><th className="py-2 pl-3 pr-5 text-right font-medium">Valor</th></tr>
              </thead>
              <tbody>
                {lost.map((l) => (
                  <tr key={l.saleId + l.adId} className="border-b border-line">
                    <td className="max-w-[420px] py-2 pl-5 pr-3"><p className="line-clamp-2" title={l.title}>{l.title}</p></td>
                    <td className="px-3"><Tag tone={l.status === 'returned' ? 'info' : 'warn'}>{l.status === 'returned' ? 'Devolução' : 'Cancelada'}</Tag> <span className="text-xs text-ink3">{l.statusText}</span></td>
                    <td className="px-3 text-ink2">{dateTimeBR(l.date)}</td>
                    <td className="py-2 pl-3 pr-5 text-right font-medium">{brl(l.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
