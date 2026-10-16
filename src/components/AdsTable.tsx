import { useMemo, useState } from 'react'
import { Package, Download } from 'lucide-react'
import type { AdRow } from '@/lib/analytics'
import { brl, int, listingUrl, competitorsUrl, pct } from '@/lib/format'
import { downloadCsv } from '@/lib/storage'
import { Button, Card, Delta, EmptyNote, ExternalLink } from './ui'

export default function AdsTable({ rows, hasPrev, curLabel, prevLabel }: { rows: AdRow[]; hasPrev: boolean; curLabel: string; prevLabel?: string }) {
  const [q,setQ] = useState('')
  const [filter,setFilter] = useState('all')
  const [sort,setSort] = useState(hasPrev?'loss':'gross')
  const [limit,setLimit] = useState(15)
  const [details,setDetails] = useState(false)
  const shown = useMemo(()=>rows.filter(r=>{
    const match=filter==='all'||filter==='drop'&&(r.unitsDelta??0)<0||filter==='stopped'&&!!r.prev?.units&&!r.cur.units||filter==='rise'&&(r.unitsDelta??0)>0||filter==='stable'&&r.unitsDelta===0
    return match&&`${r.title} ${r.adId} ${r.sku}`.toLowerCase().includes(q.trim().toLowerCase())
  }).sort((a,b)=>sort==='loss'?(a.unitsDelta??0)-(b.unitsDelta??0):sort==='units'?b.cur.units-a.cur.units:b.cur.gross-a.cur.gross),[rows,q,filter,sort])
  const signed=(v:number)=>`${v>0?'+':''}${int(v)}`
  const exportCsv=()=>downloadCsv('comparacao-produtos.csv',[
    ['Anúncio','MLB','SKU','Período anterior','Período atual','Unidades anteriores','Unidades atuais','Diferença unidades','Variação %','Faturamento anterior','Faturamento atual','Diferença R$','Preço médio','Líquido ML','Unidades por publicidade'],
    ...shown.map(r=>[r.title,r.adId,r.sku,prevLabel??'Sem cobertura',curLabel,hasPrev?r.prev?.units??0:'',r.cur.units,hasPrev?r.unitsDelta??0:'',hasPrev?r.changePct?.toFixed(2)??'':'',hasPrev?r.prev?.gross.toFixed(2)??'0.00':'',r.cur.gross.toFixed(2),hasPrev?r.revenueDelta?.toFixed(2)??'':'',r.curPrice.toFixed(2),r.cur.net.toFixed(2),r.cur.sponsoredUnits])])
  return <Card title="Quais produtos venderam mais ou menos?" subtitle={hasPrev?<>Anterior: {prevLabel} · Atual: {curLabel}. Quantidades reais, sem projeção por média diária.</>:'Importe o intervalo anterior completo para comparar. Os dados atuais continuam disponíveis.'}>
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <input aria-label="Buscar por título, MLB ou SKU" value={q} onChange={e=>{setQ(e.target.value);setLimit(15)}} placeholder="Buscar nome, MLB ou SKU" className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm" />
      {hasPrev && <select aria-label="Filtrar situação" value={filter} onChange={e=>{setFilter(e.target.value);setLimit(15)}} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"><option value="all">Todos os produtos</option><option value="drop">Qualquer queda em unidades</option><option value="stopped">Pararam de vender</option><option value="rise">Aumentaram as vendas</option><option value="stable">Mesma quantidade</option></select>}
      <select aria-label="Ordenar produtos" value={sort} onChange={e=>setSort(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">{hasPrev&&<option value="loss">Quem perdeu mais vendas</option>}<option value="gross">Maior faturamento</option><option value="units">Mais vendidos</option></select>
      <Button onClick={()=>setDetails(v=>!v)}>{details?'Ocultar detalhes':'Detalhes financeiros'}</Button>
      <Button onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
    </div>
    {!shown.length?<EmptyNote>Nenhum anúncio com esses filtros.</EmptyNote>:<div className="-mx-5 overflow-x-auto"><table className="w-full min-w-[960px] text-sm"><thead className="border-y border-line bg-surface2 text-xs text-ink3"><tr><th className="p-4 text-left font-medium">Produto / SKU</th>{hasPrev&&<th className="p-4 text-right font-medium">Antes (un.)</th>}<th className="p-4 text-right font-medium">Agora (un.)</th>{hasPrev&&<><th className="p-4 text-right font-medium">Ganhou / perdeu</th><th className="p-4 text-right font-medium">Variação</th></>}<th className="p-4 text-right font-medium">Faturamento atual</th>{details&&<>{hasPrev&&<><th className="p-4 text-right font-medium">Faturamento anterior</th><th className="p-4 text-right font-medium">Diferença R$</th></>}<th className="p-4 text-right font-medium">Preço médio</th><th className="p-4 text-right font-medium">Líquido ML</th><th className="p-4 text-right font-medium">Publicidade</th></>}<th className="p-4 text-right font-medium">Ações</th></tr></thead>
    <tbody className="divide-y divide-line">{shown.slice(0,limit).map(r=><tr key={r.adId} className="hover:bg-surface2"><td className="min-w-[250px] max-w-[360px] p-4"><div className="flex items-center gap-3"><Thumbnail url={r.thumbnail} /><div className="min-w-0"><p title={r.title} className="line-clamp-2 font-medium">{r.title}</p><p className="mt-1 break-words text-xs text-ink3">SKU: {r.sku||'Não informado'} · {r.adId}</p>{details&&<p className="mt-1 text-xs text-ink3">{r.listingType||'—'} · {r.cur.cancelled} cancel./dev.</p>}</div></div></td>{hasPrev&&<td className="tnum p-4 text-right text-ink3">{int(r.prev?.units??0)}</td>}<td className="tnum p-4 text-right font-semibold">{int(r.cur.units)}</td>{hasPrev&&<><td className={`tnum whitespace-nowrap p-4 text-right font-bold ${(r.unitsDelta??0)<0?'text-bad':(r.unitsDelta??0)>0?'text-good':'text-ink3'}`}>{signed(r.unitsDelta??0)} un.</td><td className="p-4 text-right"><Delta value={r.changePct}/>{r.changePct===null&&<span className="text-xs text-ink3">{r.cur.units?'Sem vendas anteriores':'—'}</span>}</td></>}<td className="tnum whitespace-nowrap p-4 text-right font-semibold">{brl(r.cur.gross)}</td>{details&&<>{hasPrev&&<><td className="tnum whitespace-nowrap p-4 text-right">{brl(r.prev?.gross??0)}</td><td className="tnum whitespace-nowrap p-4 text-right">{brl(r.revenueDelta??0)}</td></>}<td className="tnum whitespace-nowrap p-4 text-right">{brl(r.curPrice)}</td><td className="tnum whitespace-nowrap p-4 text-right">{brl(r.cur.net)}</td><td className="tnum p-4 text-right">{pct(r.sponsoredShare*100)}</td></>}<td className="p-4"><div className="flex flex-col items-end gap-2"><ExternalLink href={listingUrl(r.adId)}>Ver anúncio</ExternalLink><ExternalLink href={competitorsUrl(r.title)}>Ver concorrentes</ExternalLink></div></td></tr>)}</tbody></table></div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink3"><span>{Math.min(limit,shown.length)} de {shown.length} anúncios · Cada linha reúne as variações do mesmo MLB.</span>{shown.length>limit&&<Button onClick={()=>setLimit(v=>v+15)}>Mostrar mais 15</Button>}</div>
    <p className="mt-2 text-xs text-ink3">Concorrentes abre uma busca pelo título no Mercado Livre; não é uma análise automática dos anúncios encontrados.</p>
  </Card>
}
function Thumbnail({url}:{url?:string}) {
  const [failed,setFailed]=useState(false)
  return <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface2">{url&&/^https:\/\//i.test(url)&&!failed?<img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)} className="h-full w-full object-contain"/>:<Package aria-label="Foto indisponível" className="h-5 w-5 text-ink3"/>}</span>
}
