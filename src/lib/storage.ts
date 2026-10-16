import type { ImportRecord } from './types'

/**
 * Biblioteca de planilhas: fica no próprio navegador (IndexedDB).
 * Nada é enviado para nenhum servidor. Para levar o histórico a outro computador,
 * use Histórico > Exportar backup.
 */
const DB_NAME = 'central-vendas-ml'
const STORE = 'imports'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = run(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); resolve(req.result) }
    t.onerror = () => { db.close(); reject(t.error) }
    t.onabort = () => { db.close(); reject(t.error) }
  })
}

export const listImports = () => tx<ImportRecord[]>('readonly', (s) => s.getAll())
export const saveImport = (r: ImportRecord) => tx('readwrite', (s) => s.put(r))
export const deleteImport = (id: string) => tx('readwrite', (s) => s.delete(id))

/* Backup em arquivo .json */

export function downloadBackup(list: ImportRecord[]) {
  const blob = new Blob([JSON.stringify({ app: 'central-vendas-ml', version: 1, imports: list })], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `backup-central-vendas-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export async function readBackup(file: File): Promise<ImportRecord[]> {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'central-vendas-ml' || !Array.isArray(data.imports)) throw new Error('Este arquivo não é um backup da Central de Vendas.')
  return (data.imports as ImportRecord[]).filter((r) => r && r.id && Array.isArray(r.lines) && r.periodStart && r.periodEnd)
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
