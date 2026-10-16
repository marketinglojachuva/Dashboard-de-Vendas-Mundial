const nInt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const nBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const nBrl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const nPct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export const int = (n: number) => nInt.format(n)
export const brl = (n: number) => nBrl.format(n)
export const brl0 = (n: number) => nBrl0.format(n)
export const pct = (n: number) => `${nPct.format(n)}%`
export const signedPct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${nPct.format(Math.abs(n))}%`
export const signedBrl0 = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${nBrl0.format(Math.abs(n))}`
export const signedInt = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${nInt.format(Math.abs(n))}`

/** 2026-10-15 -> 15/10 */
export const dayMonth = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
/** 2026-10-15 -> 15/10/2026 */
export const dayFull = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const dateTimeBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export const compactBrl = (n: number) =>
  Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : brl0(n)

export const plural = (n: number, one: string, many: string) => `${int(n)} ${n === 1 ? one : many}`

/** Link para abrir o anúncio no Mercado Livre. */
export const listingUrl = (adId: string) => `https://produto.mercadolivre.com.br/MLB-${adId.replace(/\D/g, '')}`

/** Busca no Mercado Livre pelo título, para ver quem aparece em primeiro e a que preço. */
export function competitorsUrl(title: string) {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 7)
    .join('-')
  return `https://lista.mercadolivre.com.br/${slug}`
}
