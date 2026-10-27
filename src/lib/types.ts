/** Situação da venda para fins de análise. */
export type SaleStatus = 'valid' | 'cancelled' | 'returned'

/** Etapa operacional da venda no momento da exportação. */
export type Stage = 'nfe' | 'ship' | 'transit' | 'pickup' | 'delivered' | 'other'

/**
 * Uma linha de produto vendido. NÃO guarda nenhum dado pessoal do comprador
 * (nome, CPF, endereço): só o estado (UF), para análise geográfica.
 */
export interface SaleLine {
  sourceFile?: string
  saleId: string
  /** Data/hora local da venda: YYYY-MM-DDTHH:mm */
  date: string
  status: SaleStatus
  statusText: string
  stage: Stage
  adId: string
  sku: string
  variation?: string
  deliveryMethod?: string
  claimOpen?: boolean
  refund?: number
  thumbnail?: string
  title: string
  units: number
  /** Preço unitário de venda do anúncio */
  unitPrice: number
  /** Receita por produtos (bruto) */
  gross: number
  /** Tarifa de venda e impostos (valor negativo) */
  fee: number
  /** Receita por envio + tarifas de envio (saldo) */
  shipping: number
  /** Total (BRL): o que sobra para você */
  net: number
  attributionAvailable?: boolean
  sponsored: boolean
  listingType: string
  uf: string
  /** Veio dentro de um pacote com vários produtos */
  inPack: boolean
}

/** Uma planilha importada (um “período” na biblioteca). */
export interface ImportRecord {
  cloudRevision?: number
  originalPath?: string
  audit?: { saleRows: number; packageRows: number; rejectedRows: number }
  /** Prevent older exports from restoring sales excluded by a newer report. */
  excludedSaleIds?: string[]
  parserVersion?: number
  coverageConfirmed?: boolean
  version: 1
  id: string
  filename: string
  importedAt: string
  label: string
  /** YYYY-MM-DD */
  periodStart: string
  periodEnd: string
  /** Data/hora que o Mercado Livre gerou o relatório, se encontrada */
  exportedAt?: string
  rowsRead: number
  warnings: string[]
  lines: SaleLine[]
}
