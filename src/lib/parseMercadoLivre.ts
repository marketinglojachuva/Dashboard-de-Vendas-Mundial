import * as XLSX from 'xlsx'
import type { ImportRecord, SaleLine, SaleStatus, Stage } from './types'

/**
 * Leitor da planilha “Vendas BR” exportada da Central de Vendas do Mercado Livre.
 *
 * Particularidades do arquivo que este leitor trata:
 *  - as primeiras linhas são avisos; o cabeçalho real fica por volta da linha 6;
 *  - há uma linha de grupos acima do cabeçalho (Vendas, Compradores, Envios…),
 *    e nomes de coluna repetidos (“Estado”, “Unidades”): usamos o grupo para escolher;
 *  - datas em texto português (“15 de outubro de 2026 14:50 hs.”);
 *  - “Pacote de N produtos”: uma linha-resumo com o dinheiro do pacote, seguida de
 *    N linhas de produto sem valores. Rateamos o dinheiro entre os produtos;
 *  - dados pessoais do comprador são DESCARTADOS aqui, nunca chegam ao histórico.
 */

const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

const pad = (n: number) => String(n).padStart(2, '0')

function parseDate(v: unknown): string | null {
  if (typeof v === 'number' && v > 20000) {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}T${pad(d.H)}:${pad(d.M)}`
  }
  const s = norm(v)
  const m = s.match(/(\d{1,2}) de ([a-z]+) de (\d{4})(?: (\d{1,2}) (\d{2}))?/)
  if (m && MONTHS[m[2]]) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(+m[1])}T${pad(+(m[4] ?? 0))}:${pad(+(m[5] ?? 0))}`
  const iso = String(v ?? '').match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}T${iso[4] ?? '00'}:${iso[5] ?? '00'}`
  return null
}

function num(v: unknown): number {
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new SpreadsheetError('Valor numérico inválido no arquivo.'); return v }
  const raw=String(v ?? '').trim()
  if(!raw)return 0
  const clean=raw.replace(/^R\$\s*/, '').replace(/\s/g,'')
  const numericPattern=clean.includes(',') ? /^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/ : /^-?\d+(?:\.\d{1,2})?$/
  if(!numericPattern.test(clean)) throw new SpreadsheetError('Há um valor financeiro ou uma quantidade que não é um número. A importação foi interrompida.')
  const n=Number(clean.includes(',')?clean.replace(/\./g,'').replace(',','.'):clean)
  if(!Number.isFinite(n))throw new SpreadsheetError('Valor numérico inválido no arquivo.')
  return n
}

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === ''
const text = (v: unknown) => String(v ?? '').trim()
const round2 = (n: number) => Math.round(n * 100) / 100

function classify(statusText: string): { status: SaleStatus; stage: Stage } {
  const s = norm(statusText)
  if (s.includes('cancel')) return { status: 'cancelled', stage: 'other' }
  if (s.includes('devolu') || s.includes('devolvid') || s.includes('devolver') || s.includes('devolvemos') || (s.includes('reembolso') && !s.includes('te demos')) || s.includes('reembolsamos o valor')) return { status: 'returned', stage: 'other' }
  let stage: Stage = 'other'
  if (s.includes('fiscais') || s.includes('nf e') || s.includes('nfe')) stage = 'nfe'
  else if (s.includes('para entregar') || s.includes('vamos enviar') || s.includes('reagendado') || s.includes('coleta')) stage = 'ship'
  else if (s.includes('a caminho')) stage = 'transit'
  else if (s.includes('ponto de retirada')) stage = 'pickup'
  else if (s.includes('entregue') && !s.includes('nao entregue')) stage = 'delivered'
  const known = stage !== 'other' || /^(venda concretizada|processando no centro de distribuicao|envio atrasado|o envio esta atrasado|pacote nao entregue|mediacao finalizada te demos o dinheiro|liberamos o dinheiro da venda para voce e reembolsamos o comprador)/.test(s)
  if(!known)throw new SpreadsheetError(`Status de venda ainda não reconhecido: “${statusText}”. O arquivo não foi importado para evitar uma classificação incorreta.`)
  return { status: 'valid', stage }
}

const UF: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO',
  roraima: 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
}

export class SpreadsheetError extends Error {}

type Row = unknown[]

interface Cols {
  [key: string]: number
}

function locateColumns(header: Row, groups: string[]): { cols: Cols; missing: string[] } {
  const find = (name: string, group?: string) => {
    const n = norm(name)
    const g = group ? norm(group) : null
    for (let i = 0; i < header.length; i++) {
      if (norm(header[i]) === n && (!g || groups[i] === g)) return i
    }
    return -1
  }
  const cols: Cols = {
    saleId: find('N.º de venda'),
    date: find('Data de venda'),
    status: find('Estado', 'Vendas'),
    pack: find('Pacote de diversos produtos'),
    units: find('Unidades', 'Vendas'),
    gross: find('Receita por produtos (BRL)'),
    fee: find('Tarifa de venda e impostos (BRL)'),
    shipRev: find('Receita por envio (BRL)'),
    shipFee: find('Tarifas de envio (BRL)'),
    net: find('Total (BRL)'),
    sponsored: find('Venda por publicidade'),
    sku: find('SKU'),
    adId: find('# de anúncio'),
    variation: find('Variação'),
    deliveryMethod: find('Forma de entrega', 'Envios'),
    claimOpen: find('Reclamação aberta', 'Reclamações'),
    refund: find('Cancelamentos e reembolsos (BRL)'),
    thumbnail: find('URL da imagem'),
    title: find('Título do anúncio'),
    unitPrice: find('Preço unitário de venda do anúncio (BRL)'),
    listingType: find('Tipo de anúncio'),
    buyerUf: find('Estado', 'Compradores'),
  }
  const required: [string, string][] = [
    ['saleId', 'N.º de venda'], ['date', 'Data de venda'], ['status', 'Estado'], ['units', 'Unidades'],
    ['gross', 'Receita por produtos (BRL)'], ['net', 'Total (BRL)'], ['adId', '# de anúncio'],
    ['title', 'Título do anúncio'], ['unitPrice', 'Preço unitário de venda do anúncio (BRL)'],
    ['fee', 'Tarifa de venda e impostos (BRL)'], ['shipRev', 'Receita por envio (BRL)'], ['shipFee', 'Tarifas de envio (BRL)'],
  ]
  return { cols, missing: required.filter(([k]) => cols[k] < 0).map(([, label]) => label) }
}

interface Pack {
  remaining: number
  gross: number
  fee: number
  shipping: number
  net: number
  uf: string
  deliveryMethod: string
  refund: number
  children: SaleLine[]
}

function closePack(p: Pack) {
  const base = p.children.reduce((s,c)=>s+c.gross,0)
  // Preserve every total to the cent: put the rounding residual on the last item.
  for (const key of ['gross','fee','shipping','net','refund'] as const) {
    let allocated = 0
    p.children.forEach((c,i)=> {
      const share = base>0 ? c.units*c.unitPrice/base : 1/p.children.length
      const value = i===p.children.length-1 ? round2(p[key]-allocated) : round2(p[key]*share)
      c[key]=value; allocated=round2(allocated+value)
    })
  }
  p.children.forEach(c=>{ if(!c.uf)c.uf=p.uf; if(!c.deliveryMethod)c.deliveryMethod=p.deliveryMethod })
}

export function parseSalesBuffer(buffer: ArrayBuffer, filename: string): ImportRecord {
  let rows: Row[]
  try {
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheets=wb.SheetNames.map(n=>XLSX.utils.sheet_to_json<Row>(wb.Sheets[n],{header:1,raw:true,defval:''}))
    rows=sheets.find(rs=>rs.slice(0,40).some(r=>r.map(norm).includes('data de venda')&&r.map(norm).includes('unidades'))) ?? []
  } catch {
    throw new SpreadsheetError('Não consegui abrir este arquivo. Use a planilha .xlsx exportada em Vendas > Relatórios do Mercado Livre.')
  }

  const headerIdx = rows.slice(0, 40).findIndex((r) => {
    const cells = r.map(norm)
    return cells.includes('data de venda') && cells.includes('unidades')
  })
  if (headerIdx < 0) {
    throw new SpreadsheetError('Esta não parece ser a planilha de vendas do Mercado Livre (não achei as colunas “Data de venda” e “Unidades”).')
  }

  const groups: string[] = []
  let current = ''
  const groupRow = headerIdx > 0 ? rows[headerIdx - 1] : []
  rows[headerIdx].forEach((_, i) => {
    const g = norm(groupRow[i])
    if (g) current = g
    groups[i] = current
  })

  const { cols, missing } = locateColumns(rows[headerIdx], groups)
  if (missing.length) {
    throw new SpreadsheetError(`Faltam colunas nesta planilha: ${missing.join(', ')}.`)
  }

  let exportedAt: string | undefined
  for (const r of rows.slice(0, headerIdx)) {
    const s = norm(r[0])
    const m = s.match(/(\d{1,2}) de ([a-z]+) de (\d{4}) as (\d{1,2}) (\d{2})/)
    if (m && MONTHS[m[2]]) exportedAt = `${m[3]}-${pad(MONTHS[m[2]])}-${pad(+m[1])}T${pad(+m[4])}:${m[5]}`
  }

  const get = (r: Row, key: string) => (cols[key] >= 0 ? r[cols[key]] : '')
  const lines: SaleLine[] = []
  const warnings: string[] = []
  let rowsRead = 0
  const seen = new Set<string>()
  let packCount = 0
  let pack: Pack | null = null

  const flushPack = () => {
    if (pack) {
      if (pack.remaining > 0) throw new SpreadsheetError('Pacote incompleto ou estrutura de pacote inesperada. Exporte novamente o relatório completo.')
      closePack(pack)
      pack = null
    }
  }

  for (const r of rows.slice(headerIdx + 1)) {
    const saleId = text(get(r, 'saleId'))
    if (!saleId) { if(text(get(r,'date'))||text(get(r,'adId')))throw new SpreadsheetError('Existe uma venda sem identificador. A importação foi interrompida.'); continue }
    if(typeof get(r,'saleId')==='number'&&!Number.isSafeInteger(get(r,'saleId')))throw new SpreadsheetError('Um ID de venda foi convertido em número e perdeu precisão. Use o XLSX original exportado pelo Mercado Livre.')
    if(seen.has(saleId))throw new SpreadsheetError('Há IDs de venda repetidos dentro deste arquivo. Verifique a exportação original.')
    seen.add(saleId)
    rowsRead++
    const statusText = text(get(r, 'status'))

    // Linha-resumo do pacote: guarda o dinheiro e espera os produtos na sequência.
    const packMatch = norm(statusText).match(/^pacote de (\d+) produto/)
    if (packMatch) {
      flushPack()
      packCount++
      pack = {
        remaining: Number(packMatch[1]),
        gross: num(get(r, 'gross')),
        fee: num(get(r, 'fee')),
        shipping: num(get(r, 'shipRev')) + num(get(r, 'shipFee')),
        net: num(get(r, 'net')),
        uf: UF[norm(get(r, 'buyerUf'))] ?? '',
        deliveryMethod: text(get(r, 'deliveryMethod')),
        refund: num(get(r, 'refund')),
        children: [],
      }
      continue
    }

    const date = parseDate(get(r, 'date'))
    if (!date || !Number.isFinite(Date.parse(date)) || new Date(`${date.slice(0,10)}T00:00:00Z`).toISOString().slice(0,10)!==date.slice(0,10)) throw new SpreadsheetError('Há uma data de venda inválida. Nenhuma linha foi importada.')

    const units = num(get(r, 'units'))
    const unitPrice = num(get(r, 'unitPrice'))
    if(!Number.isInteger(units)||units<=0)throw new SpreadsheetError('Há uma quantidade de unidades inválida. Verifique o relatório original.')
    if(!text(get(r,'adId'))||!text(get(r,'title')))throw new SpreadsheetError('Uma venda está sem anúncio ou título. A importação foi interrompida.')
    const hasMoney = !isBlank(get(r, 'gross'))
    if(!hasMoney&&!pack)throw new SpreadsheetError('Uma venda está sem faturamento e sem resumo de pacote. A importação foi interrompida.')
    const { status, stage } = classify(statusText)
    if(status==='valid'&&hasMoney&&isBlank(get(r,'net')))throw new SpreadsheetError('Uma venda válida está sem total líquido. A importação foi interrompida.')
    const ufName = norm(get(r, 'buyerUf'))

    const line: SaleLine = {
      saleId,
      date,
      status,
      statusText,
      stage,
      adId: text(get(r, 'adId')),
      sku: text(get(r, 'sku')),
      variation: text(get(r, 'variation')),
      deliveryMethod: text(get(r, 'deliveryMethod')),
      claimOpen: cols.claimOpen<0 ? undefined : norm(get(r, 'claimOpen')) === 'sim',
      refund: num(get(r, 'refund')),
      thumbnail: text(get(r, 'thumbnail')) || undefined,
      title: text(get(r, 'title')),
      units,
      unitPrice,
      gross: hasMoney ? num(get(r, 'gross')) : round2(unitPrice * units),
      fee: num(get(r, 'fee')),
      shipping: num(get(r, 'shipRev')) + num(get(r, 'shipFee')),
      net: num(get(r, 'net')),
      sponsored: norm(get(r, 'sponsored')) === 'sim',
      attributionAvailable: cols.sponsored >= 0,
      listingType: text(get(r, 'listingType')),
      uf: UF[ufName] ?? '',
      inPack: norm(get(r, 'pack')) === 'sim',
    }

    if (pack && pack.remaining > 0 && !hasMoney) {
      pack.children.push(line)
      pack.remaining--
      if (pack.remaining === 0) flushPack()
    } else {
      flushPack()
    }
    lines.push(line)
  }
  flushPack()

  if(!exportedAt)throw new SpreadsheetError('Não foi encontrada a data de geração do relatório. Use o arquivo original do Mercado Livre para comparar dias completos com segurança.')
  if(lines.some(l=>l.date.slice(0,10)>exportedAt!.slice(0,10)))throw new SpreadsheetError('Existe uma venda com data posterior à geração do relatório. Confira o arquivo original.')
  if(lines.some(l=>l.date>exportedAt!))warnings.push('Existem horários de venda posteriores ao horário de geração indicado no arquivo. A análise usa datas e exclui o dia de geração inteiro.')
  if (!lines.length) throw new SpreadsheetError('A planilha não tem nenhuma venda.')

  // Reconcile raw financial columns, including package summaries, with parsed lines.
  for(const [column,key] of [['gross','gross'],['fee','fee'],['net','net'],['refund','refund']] as const){
    const expected=rows.slice(headerIdx+1).filter(r=>text(get(r,'saleId'))).reduce((sum,r)=>sum+Math.round(num(get(r,column))*100),0)
    const actual=lines.reduce((sum,l)=>sum+Math.round((l[key]??0)*100),0)
    if(expected!==actual)throw new SpreadsheetError(`Os totais financeiros de ${column} não conferem com as linhas do arquivo. A importação foi interrompida.`)
  }
  const days = lines.map((l) => l.date.slice(0, 10)).sort()
  const periodStart = days[0]
  const periodEnd = days[days.length - 1]
  const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

  return {
    version: 1,
    parserVersion: 3,
    audit: { saleRows: lines.length, packageRows: packCount, rejectedRows: 0 },
    id: `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    filename,
    importedAt: new Date().toISOString(),
    label: `Vendas ${fmt(periodStart)} a ${fmt(periodEnd)}`,
    periodStart,
    periodEnd,
    exportedAt,
    rowsRead,
    warnings,
    lines,
  }
}

export async function parseSalesFile(file: File): Promise<ImportRecord> {
  return parseSalesBuffer(await file.arrayBuffer(), file.name)
}
