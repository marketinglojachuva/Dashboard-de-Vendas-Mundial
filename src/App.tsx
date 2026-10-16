import { useEffect, useMemo, useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { FileUp, Loader2, Cloud, HardDrive, LogOut, RefreshCw } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { addDays, buildActionPlan, compareAds, summarize } from '@/lib/analytics'
import { buildPeriods, latestCompleteDate, isDate } from '@/lib/periods'
import type { ImportRecord } from '@/lib/types'
import { readBackup } from '@/lib/storage'
import { useAuth } from '@/lib/useAuth'
import { supabase, cloudConfigured, cloudConfigError } from '@/lib/supabase'
import Login from '@/components/Login'
import ThemeToggle from '@/components/ThemeToggle'
import Brand from '@/components/Brand'
import InstallApp from '@/components/InstallApp'
import { useLibrary } from '@/lib/useLibrary'
import ActionPlan from '@/components/ActionPlan'
import AdsTable from '@/components/AdsTable'
import History from '@/components/History'
import ImportDialog, { DropZone, useImporter } from '@/components/ImportDialog'
import Operations from '@/components/Operations'
import Overview from '@/components/Overview'
import Insights from '@/components/Insights'
import PeriodFilter from '@/components/PeriodFilter'
import { Button, EmptyNote } from '@/components/ui'

const DATE_KEY='central-vendas-ml:dates-v2'
const TABS=[['visao','Resumo'],['anuncios','Produtos'],['plano','Plano de ação'],['analises','Detalhes das vendas'],['operacao','Entregas'],['historico','Meus arquivos']] as const
export default function App(){
  const auth=useAuth()
  if(cloudConfigError)return <main className="p-8 text-ink"><p role="alert">{cloudConfigError}</p></main>
  if(auth.loading)return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" aria-label="Verificando acesso"/></main>
  if(cloudConfigured&&!auth.user)return <Login/>
  return <Dashboard key={auth.user?.id??'local'} userId={auth.user?.id} email={auth.user?.email}/>
}
function Dashboard({userId,email}:{userId?:string;email?:string}) {
  const lib=useLibrary(userId), importer=useImporter()
  const [dialog,setDialog]=useState(false),[tab,setTab]=useState('visao')
  const [dates,setDates]=useState({start:'',end:'',comparisonEnd:''})
  const [threshold,setThreshold]=useState(20)
  useEffect(()=>{
    if(lib.loading||!lib.items.length||dates.start)return
    let saved:null|typeof dates=null
    try {saved=JSON.parse(localStorage.getItem(`${DATE_KEY}:${userId??'local'}`)??'null')}catch{/* unavailable storage */}
    const end=latestCompleteDate(lib.items)
    setDates(saved&&isDate(saved.start)&&isDate(saved.end)?saved:{start:addDays(end,-6),end,comparisonEnd:''})
  },[lib.loading,lib.items.length,dates.start])
  const changeDates=(start:string,end:string,comparisonEnd:string)=>{const d={start,end,comparisonEnd};setDates(d);try{localStorage.setItem(`${DATE_KEY}:${userId??'local'}`,JSON.stringify(d))}catch{/* optional */}}
  const periods=useMemo(()=>buildPeriods(lib.items,dates.start,dates.end,dates.comparisonEnd),[lib.items,dates])
  const cur=periods.current,prev=periods.previous
  const tc=useMemo(()=>cur?summarize(cur):null,[cur]),tp=useMemo(()=>prev?summarize(prev):null,[prev])
  const rows=useMemo(()=>cur?compareAds(cur,prev,{threshold}):[],[cur,prev,threshold])
  const plan=useMemo(()=>buildActionPlan(rows),[rows])
  const openImport=()=>{importer.reset();setDialog(true)}
  const save=async(r:ImportRecord)=>{
    try{await lib.add(r,importer.file);if(!dates.start){const end=latestCompleteDate([...lib.items,r]);changeDates(addDays(end,-6),end,'');}importer.reset();setDialog(false);setTab('visao');toast.success('Planilha adicionada ao histórico. Vendas repetidas são conciliadas automaticamente.')}
    catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar.')}
  }
  return <div className="min-h-screen"><Toaster position="top-right" richColors theme="system"/>
    <header className="app-header border-b border-line bg-surface"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><Brand/></div><div className="flex flex-wrap items-center gap-3"><InstallApp/><ThemeToggle/><Button variant="primary" disabled={lib.busy} onClick={openImport}><FileUp className="h-4 w-4"/>Importar planilha</Button></div></div></header>
    <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-5 sm:px-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-ink3"><span className="inline-flex items-center gap-2">{lib.isCloud?<Cloud className="h-4 w-4 text-good"/>:<HardDrive className="h-4 w-4"/>}{lib.busy?'Salvando…':lib.isCloud?`Histórico na nuvem · ${email}`:'Prévia local · dados salvos neste navegador'}</span>{lib.isCloud&&<div className="flex flex-wrap gap-4"><button disabled={lib.busy} className="text-cur disabled:opacity-50" onClick={async()=>{try{const n=await lib.migrate();toast.success(`${n} arquivo(s) locais enviados à sua conta.`)}catch(e){toast.error(e instanceof Error?e.message:'Falha na transferência.')}}}>Transferir histórico deste navegador</button><button disabled={lib.busy} onClick={()=>void lib.reload()} className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3"/>Atualizar</button><button disabled={lib.busy} onClick={async()=>{const {error}=await supabase!.auth.signOut();if(error)toast.error('Não foi possível sair. Tente novamente.')}} className="inline-flex items-center gap-1"><LogOut className="h-3 w-3"/>Sair</button></div>}</div>{lib.loading?<div className="grid place-items-center py-32"><Loader2 className="animate-spin" aria-label="Carregando"/></div>:lib.error?<div role="alert" className="rounded-xl border border-line bg-surface p-6"><p>{lib.error}</p><Button className="mt-3" onClick={()=>void lib.reload()}>Tentar novamente</Button></div>:!lib.items.length?<div className="mx-auto max-w-2xl py-10"><h1 className="text-2xl font-bold">Entenda suas vendas e encontre oportunidades</h1><p className="mb-6 mt-2 text-ink3">Importe seus relatórios. O painel reúne o histórico e compara intervalos com a mesma quantidade de dias.</p><DropZone large busy={importer.busy} onFile={async f=>{await importer.read(f);setDialog(true)}}/><label className="mt-5 block cursor-pointer text-center text-sm font-medium text-cur">Ou restaurar um backup do painel<input type="file" accept=".json" className="sr-only" onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{const n=await lib.addMany(await readBackup(f));toast.success(`${n} arquivo(s) restaurados.`)}catch(err){toast.error(err instanceof Error?err.message:'Não foi possível restaurar.')}e.target.value=''}}/></label></div>:<>
    <PeriodFilter records={lib.items} {...dates} onChange={changeDates} onHistory={()=>setTab('historico')}/>
    <Tabs.Root value={tab} onValueChange={setTab}><Tabs.List aria-label="Seções" className="section-nav mb-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1.5">{TABS.map(([v,l])=><Tabs.Trigger key={v} value={v} className="whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold text-ink3 transition data-[state=active]:bg-infobg data-[state=active]:text-info">{l}</Tabs.Trigger>)}</Tabs.List>
    {cur&&tc?<><Tabs.Content value="visao"><Overview cur={cur} prev={prev} tc={tc} tp={tp} rows={rows} plan={plan} onGoto={setTab}/></Tabs.Content><Tabs.Content value="anuncios"><AdsTable key={`${cur.id}:${prev?.id}`} rows={rows} hasPrev={!!prev} curLabel={cur.label} prevLabel={prev?.label}/></Tabs.Content><Tabs.Content value="plano"><div className="mb-4 flex items-center gap-2 text-sm"><label htmlFor="threshold">Queda relevante a partir de</label><select id="threshold" value={threshold} onChange={e=>setThreshold(+e.target.value)} className="rounded-lg border border-line bg-surface p-2">{[10,20,30,50].map(t=><option key={t} value={t}>{t}%</option>)}</select><span className="text-xs text-ink3">A tabela permite ver qualquer redução em unidades.</span></div><ActionPlan plan={plan} hasPrev={!!prev}/></Tabs.Content><Tabs.Content value="analises"><Insights cur={cur}/></Tabs.Content><Tabs.Content value="operacao"><Operations cur={cur}/></Tabs.Content></>:TABS.filter(([v])=>v!=='historico').map(([v])=><Tabs.Content key={v} value={v}><EmptyNote>Ajuste as datas ou importe os relatórios que faltam para analisar o período completo.</EmptyNote></Tabs.Content>)}
    <Tabs.Content value="historico"><History items={lib.items} curId={null} prevId={null} onUseAsCurrent={id=>{const r=lib.items.find(x=>x.id===id)!;const end=latestCompleteDate([r]);changeDates(addDays(end,-6),end,'');setTab('visao')}} onUseAsPrev={id=>{const r=lib.items.find(x=>x.id===id)!;changeDates(dates.start,dates.end,latestCompleteDate([r]));setTab('visao')}} onRemove={lib.remove} onRename={lib.rename} onRestore={lib.addMany} onImport={openImport} onUpdate={lib.add} isCloud={lib.isCloud} onDownload={lib.download}/></Tabs.Content></Tabs.Root></>}
    </main><ImportDialog open={dialog} onOpenChange={setDialog} existing={lib.items} importer={importer} onSave={save}/></div>
}
