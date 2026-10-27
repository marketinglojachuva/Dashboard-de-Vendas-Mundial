import type { ImportRecord, SaleLine } from './types'
import { addDays, dayDiff } from './analytics'

export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0,10) === s
export const dateLabel = (s: string) => `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`
export const rangeLabel = (start: string, end: string) => `${dateLabel(start)} – ${dateLabel(end)}`
const freshness = (r: ImportRecord) => r.exportedAt ?? r.importedAt

/** One sale line, independent of price/status changes between exports. */
export const saleKey = (l: SaleLine) => JSON.stringify([l.saleId, l.adId])

export function consolidate(records: ImportRecord[]) {
  const map = new Map<string, SaleLine>()
  let duplicates = 0
  const sorted = [...records].sort((a,b)=>freshness(a).localeCompare(freshness(b)) || a.importedAt.localeCompare(b.importedAt))
  for (const r of sorted) {
    const excluded = new Set(r.excludedSaleIds ?? [])
    for (const [key, line] of map) {
      if (excluded.has(line.saleId)) map.delete(key)
    }
    for (const l of r.lines) {
      const key = saleKey(l)
      if (map.has(key)) duplicates++
      map.set(key,{...l,sourceFile:r.filename})
    }
  }
  return { lines: [...map.values()], duplicates }
}

/** A report exported on D cannot establish a complete D, regardless of export hour. */
export function completeEnd(r: ImportRecord) {
  return r.exportedAt && r.exportedAt.slice(0,10) <= r.periodEnd ? addDays(r.exportedAt.slice(0,10),-1) : r.periodEnd
}
export function latestCompleteDate(records: ImportRecord[]) {
  return records.map(completeEnd).filter(isDate).sort().at(-1) ?? ''
}
export function missingDays(records: ImportRecord[], start: string, end: string) {
  const result: string[] = []
  for(let i=0;i<=dayDiff(start,end);i++) {
    const d=addDays(start,i)
    if(!records.some(r=>r.periodStart<=d && completeEnd(r)>=d)) result.push(d)
  }
  return result
}
export function buildPeriods(records: ImportRecord[], start: string, end: string, comparisonEnd?: string) {
  records = records.filter(r=>r.parserVersion===3)
  const pool = consolidate(records)
  const error = !isDate(start)||!isDate(end)||start>end ? 'Informe um intervalo de datas válido.' : dayDiff(start,end)>365 ? 'Selecione até 366 dias por análise.' : null
  if(error) return { error, current: null, previous: null, currentMissing: [], previousMissing: [], previousStart:'',previousEnd:'',days:0,duplicates:pool.duplicates }
  const days=dayDiff(start,end)+1
  const pe=comparisonEnd || addDays(start,-1)
  if(!isDate(pe)||pe>=start) return {error:'A comparação deve terminar antes do início do período atual, sem sobreposição.',current:null,previous:null,currentMissing:[],previousMissing:[],previousStart:'',previousEnd:pe,days,duplicates:pool.duplicates}
  const ps=addDays(pe,1-days)
  const currentMissing=missingDays(records,start,end), previousMissing=missingDays(records,ps,pe)
  const slice=(a:string,b:string):ImportRecord=>({version:1,id:`range:${a}:${b}`,filename:'Histórico consolidado',label:rangeLabel(a,b),importedAt:'',periodStart:a,periodEnd:b,rowsRead:pool.lines.length,warnings:[],lines:pool.lines.filter(l=>l.date.slice(0,10)>=a&&l.date.slice(0,10)<=b)})
  return {error:null,current:currentMissing.length?null:slice(start,end),previous:previousMissing.length?null:slice(ps,pe),currentMissing,previousMissing,previousStart:ps,previousEnd:pe,days,duplicates:pool.duplicates}
}
