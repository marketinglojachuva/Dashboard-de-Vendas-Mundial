import { useState } from 'react'
import type { ImportRecord, SaleLine } from '@/lib/types'
import { byListingType, byState, summarize } from '@/lib/analytics'
import { brl, int, pct } from '@/lib/format'
import { BarList } from './BarList'
import { downloadCsv } from '@/lib/storage'
import { Button, Card } from './ui'

const REGIONS:Record<string,string>={AC:'Norte',AP:'Norte',AM:'Norte',PA:'Norte',RO:'Norte',RR:'Norte',TO:'Norte',AL:'Nordeste',BA:'Nordeste',CE:'Nordeste',MA:'Nordeste',PB:'Nordeste',PE:'Nordeste',PI:'Nordeste',RN:'Nordeste',SE:'Nordeste',DF:'Centro-Oeste',GO:'Centro-Oeste',MT:'Centro-Oeste',MS:'Centro-Oeste',ES:'Sudeste',MG:'Sudeste',RJ:'Sudeste',SP:'Sudeste',PR:'Sul',RS:'Sul',SC:'Sul'}
export function groupSales(lines:SaleLine[], key:(l:SaleLine)=>string) {
  const map=new Map<string,{key:string;units:number;gross:number;orders:Set<string>}>()
  for(const l of lines){const k=key(l)||'Não informado';const r=map.get(k)??{key:k,units:0,gross:0,orders:new Set<string>()};r.units+=l.units;r.gross+=l.gross;r.orders.add(l.saleId);map.set(k,r)}
  return [...map.values()].map(r=>({...r,orders:r.orders.size})).sort((a,b)=>b.gross-a.gross)
}
export default function Insights({cur}:{cur:ImportRecord}) {
  const [metric,setMetric]=useState<'gross'|'units'>('gross')
  const t=summarize(cur), valid=cur.lines.filter(l=>l.status==='valid')
  const regions=groupSales(valid,l=>REGIONS[l.uf]??'Não informado')
  const ads=groupSales(valid,l=>l.attributionAvailable===false?'Origem não informada':l.sponsored?'Vieram de publicidade':'Sem indicação de publicidade')
  const shipping=groupSales(valid,l=>l.deliveryMethod??'Não informado')
  const states=byState(cur),types=byListingType(cur)
  const bars=(list:{key:string;units:number;gross:number}[])=>[...list].sort((a,b)=>b[metric]-a[metric]).map(s=>({key:s.key,label:s.key,value:s[metric],valueLabel:metric==='gross'?brl(s.gross):`${int(s.units)} un.`,sub:metric==='gross'?`${int(s.units)} unidades`:`${brl(s.gross)} faturados`}))
  const statuses=groupSales(cur.lines,l=>l.status==='valid'?'Válidas':l.status==='cancelled'?'Canceladas':'Devolvidas / em devolução')
  const other=t.net-t.gross-t.fees-t.shipping
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Entenda de onde vêm suas vendas</h1><p className="mt-1 text-sm text-ink3">Todos os gráficos usam {cur.label}. Vendas canceladas e devolvidas ficam fora dos resultados comerciais.</p></div><select aria-label="Métrica das análises" value={metric} onChange={e=>setMetric(e.target.value as 'gross'|'units')} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"><option value="gross">Por faturamento</option><option value="units">Por unidades</option></select></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4"><p className="text-sm text-ink2">Confira os registros que formam estes números: datas, produtos, quantidades e valores da planilha.</p><Button onClick={()=>downloadCsv('conferencia-vendas-periodo.csv',[
      ['Data','ID venda','Anúncio','SKU','Produto','Unidades','Faturamento','Tarifas','Saldo envio','Líquido ML','Status original','Incluída no resumo','Arquivo de origem'],
      ...cur.lines.map(l=>[l.date,l.saleId,l.adId,l.sku,l.title,l.units,l.gross.toFixed(2),l.fee.toFixed(2),l.shipping.toFixed(2),l.net.toFixed(2),l.statusText,l.status==='valid'?'Sim':'Não',l.sourceFile??''])
    ])}>Baixar conferência em CSV</Button></div>
    <div className="grid gap-5 lg:grid-cols-2"><Card title="Regiões que mais compram"><BarList items={bars(regions)}/></Card><Card title="Publicidade e vendas sem atribuição" subtitle="A coluna da planilha identifica as vendas por publicidade."><BarList items={bars(ads)}/><p className="mt-4 text-xs text-ink3">“Sem atribuição” inclui os registros em branco: podem ser vendas orgânicas, mas o relatório não confirma a origem. Sem gasto em Ads, não é possível calcular ROAS ou ACOS.</p></Card></div>
    <Card title="Vendas por estado" subtitle="Quantidade, faturamento e participação de cada UF."><div className="grid gap-6 lg:grid-cols-2"><BarList items={bars(states).slice(0,8)}/><div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-surface text-xs text-ink3"><tr><th className="p-3 text-left">Estado</th><th className="p-3 text-right">Unidades</th><th className="p-3 text-right">Faturamento</th><th className="p-3 text-right">Part. R$</th></tr></thead><tbody className="tnum divide-y divide-line">{states.map(s=><tr key={s.key}><td className="p-3">{s.key}</td><td className="p-3 text-right">{int(s.units)}</td><td className="whitespace-nowrap p-3 text-right">{brl(s.gross)}</td><td className="p-3 text-right">{pct(t.gross?s.gross/t.gross*100:0)}</td></tr>)}</tbody></table></div></div></Card>
    <div className="grid gap-5 lg:grid-cols-2"><Card title="Tipo de anúncio" subtitle="Clássico, Premium e outros tipos informados."><BarList items={bars(types)}/></Card><Card title="Forma de entrega" subtitle="Distribuição das vendas por modalidade de envio."><BarList items={bars(shipping)}/></Card></div>
    <div className="grid gap-5 lg:grid-cols-2"><Card title="Do faturamento ao líquido ML" subtitle="Valores das vendas válidas. Não inclui custo dos produtos."><dl className="divide-y divide-line text-sm">{[['Faturamento por produtos',t.gross],['Tarifas de venda e impostos',t.fees],['Saldo de envio (receitas − tarifas)',t.shipping],['Outros ajustes do relatório',other],['Líquido informado pelo ML',t.net]].map(([label,value])=><div key={label} className="flex justify-between gap-3 py-3 last:font-bold"><dt>{label}</dt><dd className="tnum whitespace-nowrap">{brl(Number(value))}</dd></div>)}</dl><p className="mt-3 text-xs text-ink3">O líquido informado não comprova saldo disponível em conta. Pacotes têm valores financeiros rateados entre produtos, preservando o total do pacote.</p></Card><Card title="Cancelamentos e devoluções" subtitle="Situação conhecida na exportação mais recente de cada venda."><BarList items={statuses.map(s=>({key:s.key,label:s.key,value:s.orders,valueLabel:`${int(s.orders)} registros`,sub:`${int(s.units)} unidades · ${brl(s.gross)} em produtos`}))}/><p className="mt-4 text-xs text-ink3">Valores cancelados/devolvidos são receita de produtos afetada, não uma estimativa de prejuízo. Devoluções em andamento também são excluídas das vendas válidas.</p><p className="mt-3 text-sm">Reclamações abertas: <b>{cur.lines.some(l=>l.claimOpen!==undefined)?int(new Set(cur.lines.filter(l=>l.claimOpen).map(l=>l.saleId)).size):'Não informado'}</b> registros.</p></Card></div>
  </div>
}
