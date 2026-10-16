import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ImportRecord } from './types'
import { deleteImport, listImports, saveImport } from './storage'
import { sortLibrary } from './analytics'
import { cloudStore } from './cloudStorage'
import { supabase } from './supabase'

export function useLibrary(userId?:string) {
  const cloud=useMemo(()=>supabase&&userId?cloudStore(supabase,userId):null,[userId])
  const [items,setItems]=useState<ImportRecord[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null)
  const generation=useRef(0)
  const reload=useCallback(async()=>{
    const version=++generation.current
    try{const list=cloud?await cloud.list():await listImports();if(version===generation.current){setItems(sortLibrary(list));setError(null)}}
    catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Não foi possível carregar o histórico.')}
    finally{if(version===generation.current)setLoading(false)}
  },[cloud])
  useEffect(()=>{void reload();const focus=()=>void reload();window.addEventListener('focus',focus);return()=>{generation.current++;window.removeEventListener('focus',focus)}},[reload])
  const add=useCallback(async(r:ImportRecord,file?:File)=>{
    setBusy(true)
    try{
      const existing=items.find(i=>i.id===r.id||i.filename===r.filename)
      const next={...r,id:existing?.id??r.id,cloudRevision:existing?.cloudRevision,originalPath:existing?.originalPath}
      const saved=cloud?await cloud.save(next,file):(await saveImport(next),next)
      generation.current++;setItems(old=>sortLibrary([...old.filter(i=>i.id!==saved.id),saved]));setError(null)
    }finally{setBusy(false)}
  },[cloud,items])
  const addMany=useCallback(async(list:ImportRecord[])=>{
    setBusy(true)
    let count=0
    const knownNames=new Set(items.map(r=>r.filename)),knownIds=new Set(items.map(r=>r.id))
    try{
      for(const r of list){
        if(knownNames.has(r.filename)||knownIds.has(r.id))continue
        const {cloudRevision:_,originalPath:__,...clean}=r
        const saved=cloud?await cloud.save(clean):(await saveImport(clean),clean)
        generation.current++;setItems(old=>sortLibrary([...old,saved]));count++;knownNames.add(r.filename);knownIds.add(r.id)
      }
      return count
    }catch(e){throw new Error(`${count} arquivo(s) foram salvos antes da interrupção. ${e instanceof Error?e.message:'Tente novamente.'}`)}
    finally{setBusy(false)}
  },[cloud,items])
  const remove=useCallback(async(id:string)=>{
    const r=items.find(i=>i.id===id);if(!r)return
    setBusy(true)
    try{if(cloud){const warning=await cloud.remove(r);if(warning)toast.warning(warning)}else await deleteImport(id);generation.current++;setItems(old=>old.filter(i=>i.id!==id))}
    catch(e){toast.error(e instanceof Error?e.message:'Não foi possível excluir.')}
    finally{setBusy(false)}
  },[cloud,items])
  const rename=useCallback(async(id:string,label:string)=>{const r=items.find(i=>i.id===id);if(r)try{await add({...r,label})}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível renomear.')}},[items,add])
  const migrate=async()=>{if(!cloud)return 0;return addMany(await listImports())}
  const download=async(r:ImportRecord)=>{if(cloud)try{await cloud.download(r)}catch(e){toast.error(e instanceof Error?e.message:'Falha ao baixar.')}}
  return {items,loading,busy,error,add,addMany,remove,rename,reload,migrate,download,isCloud:!!cloud}
}
