import { useRef, useState } from 'react'
import { Download, FolderOpen, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { ImportRecord } from '@/lib/types'
import { periodDays, summarize } from '@/lib/analytics'
import { brl, dateTimeBR, dayFull, int } from '@/lib/format'
import { downloadBackup, readBackup } from '@/lib/storage'
import { isDate } from '@/lib/periods'
import { Button, Card, EmptyNote, Tag } from './ui'

export default function History({ items, curId, prevId, onUseAsCurrent, onUseAsPrev, onRemove, onRename, onRestore, onImport, onUpdate, isCloud, onDownload }: {
  items: ImportRecord[]; curId: string | null; prevId: string | null
  onUseAsCurrent: (id: string) => void; onUseAsPrev: (id: string) => void
  onRemove: (id: string) => Promise<void>; onRename: (id: string, label: string) => Promise<void>
  isCloud?: boolean; onDownload?: (record:ImportRecord)=>Promise<void>
  onUpdate: (record: ImportRecord) => Promise<void>
  onRestore: (list: ImportRecord[]) => Promise<number>; onImport: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const restore = async (file?: File) => {
    if (!file) return
    try {
      const list = await readBackup(file)
      const fresh = list.filter((r) => !items.some((i) => i.id === r.id))
      const count=await onRestore(fresh)
      toast.success(`${count} planilha(s) restaurada(s). Os arquivos que já existiam foram mantidos.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não consegui ler o backup.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Card title="Planilhas importadas" subtitle={isCloud ? "Histórico salvo na sua conta. As análises são reconstruídas ao escolher qualquer período disponível." : "Histórico salvo apenas neste navegador. Exporte um backup antes de trocar de dispositivo ou endereço."}
      action={
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => downloadBackup(items)} disabled={!items.length}><Download className="h-4 w-4" aria-hidden />Exportar backup</Button>
          <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" aria-hidden />Restaurar backup</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void restore(e.target.files?.[0])} />
        </div>
      }>
      {items.length === 0 ? (
        <div className="space-y-3"><EmptyNote>Você ainda não importou nenhuma planilha.</EmptyNote><div className="text-center"><Button variant="primary" onClick={onImport}>Importar planilha</Button></div></div>
      ) : (
        <div className="relative -mx-5 overflow-x-auto">
          <table className="tnum w-full min-w-[880px] text-[13px]">
            <thead className="border-y border-line bg-surface2 text-left text-ink3">
              <tr>
                <th className="py-2 pl-5 pr-3 font-medium">Nome</th><th className="px-3 font-medium">Período</th>
                <th className="px-3 text-right font-medium">Unidades</th><th className="px-3 text-right font-medium">Faturamento</th>
                <th className="px-3 font-medium">Importada em</th><th className="py-2 pl-3 pr-5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const t = summarize(r)
                return (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="py-3 pl-5 pr-3">
                      <input defaultValue={r.label} aria-label="Nome da planilha" maxLength={60}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== r.label) void onRename(r.id, v) }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        className="w-56 rounded-md border border-transparent bg-transparent px-1.5 py-1 font-medium text-ink hover:border-line2 focus:border-line2" />
                      <p className="mt-0.5 truncate px-1.5 text-xs text-ink3" title={r.filename}>{r.filename}</p>
                      {!!r.audit?.rejectedRows && <p className="mt-1 max-w-64 px-1.5 text-xs text-warn">{r.audit.rejectedRows} linha(s) ignorada(s) por pós-venda ou pacote vinculado. Totais apenas dos registros aceitos.</p>}
                      <div className="mt-1 flex gap-1.5 px-1.5">{r.id === curId && <Tag tone="info">Período atual</Tag>}{r.id === prevId && <Tag>Comparação</Tag>}</div>
                    </td>
                    <td className="px-3 py-3 text-ink2">{dayFull(r.periodStart)} a {dayFull(r.periodEnd)}<span className="block text-xs text-ink3">{periodDays(r)} dias · {r.coverageConfirmed ? 'Cobertura confirmada' : 'Cobertura estimada'}</span><Coverage record={r} onSave={onUpdate}/></td>
                    <td className="px-3 py-3 text-right text-ink">{int(t.units)}</td>
                    <td className="px-3 py-3 text-right text-ink">{brl(t.gross)}</td>
                    <td className="px-3 py-3 text-ink2">{dateTimeBR(r.importedAt)}</td>
                    <td className="py-3 pl-3 pr-5">
                      <div className="flex flex-wrap gap-1.5">
                        <Button className="!px-2.5 !py-1 !text-xs" onClick={() => onUseAsCurrent(r.id)}><FolderOpen className="h-3.5 w-3.5" aria-hidden />Abrir</Button>
                        <Button className="!px-2.5 !py-1 !text-xs" onClick={() => onUseAsPrev(r.id)}>Usar como comparação</Button>
                        {isCloud && r.originalPath && <Button className="!px-2.5 !py-1 !text-xs" onClick={()=>void onDownload?.(r)}>Baixar XLSX original</Button>}
                        <Button variant="danger" className="!px-2.5 !py-1 !text-xs" onClick={() => { if (window.confirm(`Excluir “${r.label}” do histórico? Esta ação não pode ser desfeita.`)) void onRemove(r.id) }}><Trash2 className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">Excluir</span></Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

function Coverage({record,onSave}:{record:ImportRecord;onSave:(r:ImportRecord)=>Promise<void>}) {
  const [start,setStart]=useState(record.periodStart),[end,setEnd]=useState(record.periodEnd),[saving,setSaving]=useState(false)
  const [editing,setEditing]=useState(false)
  const dates=record.lines.map(l=>l.date.slice(0,10)).sort()
  const invalid=!isDate(start)||!isDate(end)||start>end||start>dates[0]||end<dates[dates.length-1]||!!record.exportedAt&&end>record.exportedAt.slice(0,10)
  if(!editing)return <button className="mt-2 text-xs font-semibold text-cur underline" onClick={()=>setEditing(true)}>Conferir cobertura</button>
  return <div className="mt-2 space-y-2"><p className="max-w-64 text-xs text-ink3">Informe o intervalo completo escolhido na exportação do Mercado Livre, mesmo se houver dias sem vendas.</p><label className="block text-xs">Início exportado<input type="date" value={start} onChange={e=>setStart(e.target.value)} className="block rounded border border-line p-1"/></label><label className="block text-xs">Fim exportado<input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="block rounded border border-line p-1"/></label>{invalid&&<p className="max-w-64 text-xs text-bad">O intervalo deve conter todas as vendas e terminar até a data da exportação.</p>}<Button disabled={invalid||saving} onClick={async()=>{setSaving(true);try{await onSave({...record,periodStart:start,periodEnd:end,coverageConfirmed:true});setEditing(false)}catch{toast.error('Não foi possível salvar a cobertura.')}finally{setSaving(false)}}}>Confirmar datas</Button></div>
}
