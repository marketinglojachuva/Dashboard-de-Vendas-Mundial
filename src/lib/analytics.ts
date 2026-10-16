import type { ImportRecord, SaleLine, Stage } from './types'

const DAY = 86400000
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY)
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10)
export const periodDays = (r: Pick<ImportRecord, 'periodStart' | 'periodEnd'>) => Math.max(1, dayDiff(r.periodStart, r.periodEnd) + 1)

const valid = (r: ImportRecord) => r.lines.filter((l) => l.status === 'valid')

/* ───────────── Totais do período ───────────── */

export interface Totals {
  days: number
  units: number
  orders: number
  gross: number
  net: number
  fees: number
  shipping: number
  ticket: number
  /** líquido ÷ bruto */
  margin: number
  ads: number
  sponsoredUnits: number
  sponsoredShare: number
  cancelledOrders: number
  returnedOrders: number
  lostGross: number
  lostRate: number
}

export function summarize(r: ImportRecord): Totals {
  let units = 0, orders = 0, gross = 0, net = 0, fees = 0, shipping = 0, sponsoredUnits = 0
  let cancelledOrders = 0, returnedOrders = 0, lostGross = 0
  const ads = new Set<string>()
  const orderIds = new Set<string>(), cancelledIds = new Set<string>(), returnedIds = new Set<string>()
  for (const l of r.lines) {
    if (l.status === 'valid') {
      units += l.units; orderIds.add(l.saleId); gross += l.gross; net += l.net; fees += l.fee; shipping += l.shipping
      if (l.sponsored) sponsoredUnits += l.units
      ads.add(l.adId)
    } else {
      lostGross += l.gross
      if (l.status === 'cancelled') cancelledIds.add(l.saleId)
      else returnedIds.add(l.saleId)
    }
  }
  orders=orderIds.size; cancelledOrders=cancelledIds.size; returnedOrders=returnedIds.size
  const total = orders + cancelledOrders + returnedOrders
  return {
    days: periodDays(r), units, orders, gross, net, fees, shipping,
    ticket: orders ? gross / orders : 0,
    margin: gross ? net / gross : 0,
    ads: ads.size,
    sponsoredUnits,
    sponsoredShare: units ? sponsoredUnits / units : 0,
    cancelledOrders, returnedOrders, lostGross,
    lostRate: total ? (cancelledOrders + returnedOrders) / total : 0,
  }
}

/** Variação % da média por dia (compara períodos de durações diferentes). */
export function rateChange(cur: number, curDays: number, prev: number, prevDays: number): number | null {
  const p = prev / prevDays
  if (p === 0) return null
  return ((cur / curDays - p) / p) * 100
}

/* ───────────── Série diária ───────────── */

export interface DayPoint {
  i: number
  curDate?: string
  prevDate?: string
  cur?: { units: number; gross: number; orders: number }
  prev?: { units: number; gross: number; orders: number }
}

function byDay(r: ImportRecord) {
  const map = new Map<string, { units: number; gross: number; orders: number }>()
  for (const l of r.lines) {
    if (l.status !== 'valid') continue
    const d = l.date.slice(0, 10)
    const e = map.get(d) ?? { units: 0, gross: 0, orders: 0 }
    e.units += l.units; e.gross += l.gross; e.orders++
    map.set(d, e)
  }
  return map
}

export function dailySeries(cur: ImportRecord, prev: ImportRecord | null): DayPoint[] {
  const cm = byDay(cur), pm = prev ? byDay(prev) : null
  const nc = periodDays(cur), np = prev ? periodDays(prev) : 0
  const out: DayPoint[] = []
  for (let i = 0; i < Math.max(nc, np); i++) {
    const p: DayPoint = { i }
    if (i < nc) {
      p.curDate = addDays(cur.periodStart, i)
      p.cur = cm.get(p.curDate) ?? { units: 0, gross: 0, orders: 0 }
    }
    if (prev && pm && i < np) {
      p.prevDate = addDays(prev.periodStart, i)
      p.prev = pm.get(p.prevDate) ?? { units: 0, gross: 0, orders: 0 }
    }
    out.push(p)
  }
  return out
}

/* ───────────── Anúncios: comparação entre períodos ───────────── */

export interface AdAgg {
  units: number
  gross: number
  net: number
  orders: number
  sponsoredUnits: number
  cancelled: number
}

const emptyAgg = (): AdAgg => ({ units: 0, gross: 0, net: 0, orders: 0, sponsoredUnits: 0, cancelled: 0 })

export type AdStatus = 'drop' | 'rise' | 'new' | 'stopped' | 'stable' | 'none'

export interface AdRow {
  adId: string
  thumbnail?: string
  title: string
  sku: string
  listingType: string
  cur: AdAgg
  prev: AdAgg | null
  curPrice: number
  prevPrice: number | null
  /** variação % de unidades nos intervalos equivalentes */
  changePct: number | null
  /** diferença real de faturamento em intervalos equivalentes */
  revenueDelta: number | null
  /** diferença real de unidades em intervalos equivalentes */
  unitsDelta: number | null
  priceChangePct: number | null
  sponsoredShare: number
  prevSponsoredShare: number | null
  margin: number
  status: AdStatus
}

interface AdMeta { thumbnail?: string; title: string; sku: string; listingType: string }

function aggregate(r: ImportRecord) {
  const aggs = new Map<string, AdAgg>()
  const meta = new Map<string, AdMeta>()
  for (const l of r.lines) {
    if (!l.adId) continue
    if (!meta.has(l.adId)) meta.set(l.adId, { thumbnail: l.thumbnail, title: l.title, sku: l.sku, listingType: l.listingType })
    else if (l.sku) { const m=meta.get(l.adId)!; m.sku=[...new Set([...m.sku.split(' · ').filter(Boolean),l.sku])].join(' · ') }
    const a = aggs.get(l.adId) ?? emptyAgg()
    if (l.status === 'valid') {
      a.units += l.units; a.gross += l.gross; a.net += l.net; a.orders++
      if (l.sponsored) a.sponsoredUnits += l.units
    } else a.cancelled++
    aggs.set(l.adId, a)
  }
  return { aggs, meta }
}

export interface CompareOptions {
  /** queda/alta mínima, em % (ex.: 20) */
  threshold: number
}

export function compareAds(cur: ImportRecord, prev: ImportRecord | null, opts: CompareOptions): AdRow[] {
  const c = aggregate(cur)
  const p = prev ? aggregate(prev) : null
  if (prev && periodDays(cur) !== periodDays(prev)) throw new Error('Compare apenas intervalos com a mesma quantidade de dias.')
  const ids = new Set([...c.aggs.keys(), ...(p ? p.aggs.keys() : [])])
  const rows: AdRow[] = []
  for (const id of ids) {
    const ca = c.aggs.get(id) ?? emptyAgg()
    const pa = p ? p.aggs.get(id) ?? emptyAgg() : null
    const meta = c.meta.get(id) ?? p?.meta.get(id) ?? { title: id, sku: '', listingType: '' }
    const curPrice = ca.units ? ca.gross / ca.units : 0
    const prevPrice = pa && pa.units ? pa.gross / pa.units : null
    let status: AdStatus = 'none'
    let changePct: number | null = null
    let revenueDelta: number | null = null
    let unitsDelta: number | null = null
    if (pa) {
      const expected = pa.units
      unitsDelta = ca.units - expected
      revenueDelta = ca.gross - pa.gross
      changePct = pa.units ? ((ca.units - pa.units) / pa.units) * 100 : null
      if (pa.units === 0 && ca.units > 0) status = 'new'
      else if (pa.units > 0 && ca.units === 0) status = 'stopped'
      else if (changePct !== null && changePct <= -opts.threshold && unitsDelta <= -2) status = 'drop'
      else if (changePct !== null && changePct >= opts.threshold && unitsDelta >= 2) status = 'rise'
      else status = 'stable'
    }
    rows.push({
      adId: id, ...meta, cur: ca, prev: pa, curPrice, prevPrice, changePct, revenueDelta, unitsDelta,
      priceChangePct: prevPrice && curPrice ? ((curPrice - prevPrice) / prevPrice) * 100 : null,
      sponsoredShare: ca.units ? ca.sponsoredUnits / ca.units : 0,
      prevSponsoredShare: pa && pa.units ? pa.sponsoredUnits / pa.units : null,
      margin: ca.gross ? ca.net / ca.gross : 0,
      status,
    })
  }
  return rows.sort((a, b) => b.cur.units - a.cur.units || (b.prev?.units ?? 0) - (a.prev?.units ?? 0))
}

/** Por que um anúncio provavelmente caiu: pistas, não certezas. */
export function dropClues(r: AdRow): string[] {
  const out: string[] = []
  if (r.priceChangePct !== null && r.priceChangePct >= 3) out.push(`Preço subiu ${r.priceChangePct.toFixed(0)}%`)
  if (r.priceChangePct !== null && r.priceChangePct <= -3) out.push(`Preço caiu ${Math.abs(r.priceChangePct).toFixed(0)}%`)
  if (r.prev && r.prev.sponsoredUnits > 0 && r.cur.sponsoredUnits < r.prev.sponsoredUnits)
    out.push(`Vendas por publicidade: ${r.prev.sponsoredUnits} → ${r.cur.sponsoredUnits}`)
  if (r.cur.sponsoredUnits === 0 && (r.prev?.sponsoredUnits ?? 0) === 0) out.push('Sem publicidade')
  if (r.cur.cancelled > 0) out.push(`${r.cur.cancelled} cancelada(s)/devolvida(s)`)
  return out
}

export interface ActionPlan {
  drops: AdRow[]
  stopped: AdRow[]
  /** vendem bem sem publicidade */
  sponsorCandidates: AdRow[]
  rises: AdRow[]
}

export function buildActionPlan(rows: AdRow[]): ActionPlan {
  const byLoss = (a: AdRow, b: AdRow) => (a.revenueDelta ?? 0) - (b.revenueDelta ?? 0)
  return {
    drops: rows.filter((r) => r.status === 'drop').sort(byLoss),
    stopped: rows.filter((r) => r.status === 'stopped' && (r.prev?.units ?? 0) >= 2).sort(byLoss),
    sponsorCandidates: rows
      .filter((r) => r.cur.units >= 3 && r.sponsoredShare < 0.2 && r.margin >= 0.6 && r.status !== 'drop')
      .sort((a, b) => b.cur.gross - a.cur.gross),
    rises: rows.filter((r) => r.status === 'rise').sort((a, b) => (b.revenueDelta ?? 0) - (a.revenueDelta ?? 0)),
  }
}

/* ───────────── Cortes (UF, publicidade, tipo, operação) ───────────── */

export interface Slice { key: string; units: number; gross: number; net: number }

function sliceBy(r: ImportRecord, keyOf: (l: SaleLine) => string): Slice[] {
  const m = new Map<string, Slice>()
  for (const l of valid(r)) {
    const k = keyOf(l)
    const s = m.get(k) ?? { key: k, units: 0, gross: 0, net: 0 }
    s.units += l.units; s.gross += l.gross; s.net += l.net
    m.set(k, s)
  }
  return [...m.values()].sort((a, b) => b.gross - a.gross)
}

export const byState = (r: ImportRecord) => sliceBy(r, (l) => l.uf || '—')
export const byListingType = (r: ImportRecord) => sliceBy(r, (l) => l.listingType || '—')
export const bySponsored = (r: ImportRecord) => sliceBy(r, (l) => (l.sponsored ? 'Com publicidade' : 'Orgânica'))

export const STAGE_LABEL: Record<Stage, string> = {
  nfe: 'NF-e pendente',
  ship: 'Para enviar',
  transit: 'A caminho',
  pickup: 'No ponto de retirada',
  delivered: 'Entregue',
  other: 'Outros',
}

export function stageCounts(r: ImportRecord) {
  const m = new Map<Stage, { orders: number; gross: number }>()
  for (const l of valid(r)) {
    const e = m.get(l.stage) ?? { orders: 0, gross: 0 }
    e.orders++; e.gross += l.gross
    m.set(l.stage, e)
  }
  return (['nfe', 'ship', 'transit', 'pickup', 'delivered', 'other'] as Stage[])
    .filter((s) => m.has(s))
    .map((s) => ({ stage: s, label: STAGE_LABEL[s], ...m.get(s)! }))
}

export const lostLines = (r: ImportRecord) =>
  r.lines.filter((l) => l.status !== 'valid').sort((a, b) => b.gross - a.gross)

/* ───────────── Biblioteca: escolha padrão de períodos ───────────── */

export function sortLibrary(list: ImportRecord[]) {
  return [...list].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.importedAt.localeCompare(a.importedAt))
}

export function defaultSelection(list: ImportRecord[]): { curId: string | null; prevId: string | null } {
  const s = sortLibrary(list)
  return { curId: s[0]?.id ?? null, prevId: s[1]?.id ?? null }
}

export const fingerprint = (r: ImportRecord) =>
  `${r.periodStart}|${r.periodEnd}|${r.lines.length}|${r.lines.reduce((s, l) => s + l.units, 0)}`
