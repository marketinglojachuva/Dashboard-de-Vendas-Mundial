import { useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, FileSpreadsheet, Loader2, X } from 'lucide-react'
import type { ImportRecord } from '@/lib/types'
import { fingerprint, periodDays, summarize } from '@/lib/analytics'
import { parseSalesFile, SpreadsheetError } from '@/lib/parseMercadoLivre'
import { brl, int, plural } from '@/lib/format'
import { isDate } from '@/lib/periods'
import { Button } from './ui'

export function DropZone({ onFile, busy, large }: { onFile: (f: File) => void; busy?: boolean; large?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
      className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition ${large ? 'px-6 py-16' : 'px-6 py-10'} ${over ? 'border-cur bg-infobg' : 'border-line2 bg-surface2'}`}>
      {busy ? <Loader2 className="h-8 w-8 animate-spin text-ink3" aria-hidden /> : <FileSpreadsheet className="h-8 w-8 text-ink3" aria-hidden />}
      <p className="mt-3 text-[15px] font-semibold text-ink">{busy ? 'Lendo a planilha…' : 'Arraste a planilha de vendas aqui'}</p>
      <p className="mt-1 text-[13px] text-ink3">Arquivo .xlsx exportado em Vendas › Relatórios do Mercado Livre</p>
      <Button variant="primary" className="mt-4" disabled={busy} onClick={() => ref.current?.click()}>Escolher arquivo</Button>
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden" data-testid="file-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}

export function useImporter() {
  const [file, setFile] = useState<File | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ImportRecord | null>(null)
  const read = async (file: File) => {
    setBusy(true); setError(null); setFile(undefined)
    try { setDraft(await parseSalesFile(file)); setFile(file) }
    catch (e) { setError(e instanceof SpreadsheetError ? e.message : 'Não foi possível ler esta planilha.') }
    finally { setBusy(false) }
  }
  return { file, busy, error, draft, setDraft, read, reset: () => { setDraft(null); setFile(undefined); setError(null) } }
}

export default function ImportDialog({ open, onOpenChange, existing, importer, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; existing: ImportRecord[]; importer: ReturnType<typeof useImporter>; onSave: (r: ImportRecord) => Promise<void>
}) {
  const { draft, setDraft, busy, error, read, reset } = importer
  const [saving, setSaving] = useState(false)
  const dup = draft ? existing.find((e) => fingerprint(e) === fingerprint(draft)) : undefined
  const t = draft ? summarize(draft) : null
  const saleDates = draft?.lines.map(l=>l.date.slice(0,10)).sort() ?? []
  const invalidDates = !!draft && (!isDate(draft.periodStart) || !isDate(draft.periodEnd) || draft.periodStart > draft.periodEnd || draft.periodStart > saleDates[0] || draft.periodEnd < saleDates[saleDates.length-1] || !!draft.exportedAt && draft.periodEnd > draft.exportedAt.slice(0,10))

  const close = (o: boolean) => { if (!o) reset(); onOpenChange(o) }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[92vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-ink">Importar planilha de vendas</Dialog.Title>
              <Dialog.Description className="mt-1 text-[13px] text-ink3">A análise não inclui dados pessoais dos compradores. O XLSX original é guardado de forma privada na sua conta quando a nuvem está ativa.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Fechar" className="rounded-md p-1 text-ink3 hover:bg-surface2"><X className="h-5 w-5" /></Dialog.Close>
          </div>

          <div className="mt-5">
            {!draft ? (
              <>
                <DropZone onFile={read} busy={busy} />
                {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-badbg px-3 py-2 text-[13px] text-bad"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{error}</p>}
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-surface2 p-4 text-[13px]">
                  <p className="truncate font-semibold text-ink" title={draft.filename}>{draft.filename}</p>
                  <dl className="tnum mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                    <div><dt className="text-ink3">Vendas</dt><dd className="font-semibold text-ink">{int(t!.orders)}</dd></div>
                    <div><dt className="text-ink3">Unidades</dt><dd className="font-semibold text-ink">{int(t!.units)}</dd></div>
                    <div><dt className="text-ink3">Faturamento</dt><dd className="font-semibold text-ink">{brl(t!.gross)}</dd></div>
                    <div><dt className="text-ink3">Anúncios</dt><dd className="font-semibold text-ink">{int(t!.ads)}</dd></div>
                  </dl>
                  {t!.cancelledOrders + t!.returnedOrders > 0 && <p className="mt-3 text-ink3">{plural(t!.cancelledOrders + t!.returnedOrders, 'venda cancelada ou devolvida ficou', 'vendas canceladas ou devolvidas ficaram')} fora dos totais.</p>}
                </div>

                <label className="block text-[13px] font-medium text-ink">Nome
                  <input value={draft.label} maxLength={60} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className="mt-1 w-full rounded-lg border border-line2 bg-surface px-3 py-2 text-sm font-normal" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[13px] font-medium text-ink">Início do período
                    <input type="date" value={draft.periodStart} onChange={(e) => setDraft({ ...draft, periodStart: e.target.value, coverageConfirmed: false })} className="mt-1 w-full rounded-lg border border-line2 bg-surface px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="block text-[13px] font-medium text-ink">Fim do período
                    <input type="date" value={draft.periodEnd} onChange={(e) => setDraft({ ...draft, periodEnd: e.target.value, coverageConfirmed: false })} className="mt-1 w-full rounded-lg border border-line2 bg-surface px-3 py-2 text-sm font-normal" />
                  </label>
                </div>
                <p className="text-xs text-ink3">{invalidDates ? <span className="text-bad">O intervalo deve conter todas as vendas e terminar até a data da exportação.</span> : <>Detectado pelas datas das vendas: {plural(periodDays(draft), 'dia', 'dias')}. Ajuste só se você exportou um intervalo maior que o das vendas.</>}</p>

                <p className="rounded-lg bg-warnbg p-3 text-xs text-warn">Confira o intervalo completo escolhido ao exportar no Mercado Livre, incluindo dias sem vendas. A primeira e a última venda são apenas uma estimativa. Confirme as datas abaixo para salvar.</p>
                <label className="flex items-start gap-2 text-xs text-ink3"><input type="checkbox" checked={!!draft.coverageConfirmed} onChange={e=>setDraft({...draft,coverageConfirmed:e.target.checked})}/>Confirmo que estas são as datas usadas na exportação, incluindo dias sem vendas. O dia da exportação será tratado como parcial.</label>
                <p className="rounded-lg bg-infobg p-3 text-xs text-info">Conferência: {draft.audit?.saleRows ?? draft.lines.length} registros de produtos · {draft.audit?.packageRows ?? 0} resumos de pacotes · nenhuma linha ignorada.</p>
                {dup && <p role="alert" className="flex items-start gap-2 rounded-lg bg-warnbg px-3 py-2 text-[13px] text-warn"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />Parece que esta planilha já foi importada como “{dup.label}”.</p>}
                {draft.warnings.map((w) => <p key={w} className="text-xs text-ink3">{w}</p>)}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" onClick={reset}>Trocar arquivo</Button>
                  <Button variant="primary" disabled={saving || invalidDates || !draft.coverageConfirmed || !draft.label.trim()} onClick={async () => { setSaving(true); try { await onSave(draft) } finally { setSaving(false) } }}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{existing.some(r=>r.filename===draft.filename) ? 'Atualizar este arquivo' : 'Salvar e analisar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
