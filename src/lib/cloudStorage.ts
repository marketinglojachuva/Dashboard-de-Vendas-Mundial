import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportRecord } from './types'
export const IMPORT_TABLE='ml_imports'
export const FILE_BUCKET='ml-spreadsheets'

/** Cloud is authoritative when enabled. Failed writes never fall back silently to local storage. */
export function cloudStore(client:SupabaseClient,userId:string) {
  const clean=(r:ImportRecord)=>{const {cloudRevision:_,...record}=r;return record}
  return {
    async list():Promise<ImportRecord[]> {
      const result:ImportRecord[]=[]
      for(let from=0;;from+=100){
        const {data,error}=await client.from(IMPORT_TABLE).select('id,record,revision').eq('user_id',userId).order('id').range(from,from+99)
        if(error)throw new Error('Não foi possível carregar o histórico da nuvem. Confira a conexão e a configuração do banco.')
        for(const row of data ?? [])result.push({...row.record,id:row.id,cloudRevision:row.revision})
        if((data?.length??0)<100)return result
      }
    },
    async save(r:ImportRecord,file?:File):Promise<ImportRecord> {
      let uploaded:string|undefined
      if(file){
        uploaded=`${userId}/${r.id}/${crypto.randomUUID()}.${file.name.toLowerCase().endsWith('.xls')?'xls':'xlsx'}`
        const {error}=await client.storage.from(FILE_BUCKET).upload(uploaded,file,{upsert:false})
        if(error)throw new Error('Não foi possível salvar a planilha original na nuvem. Nada foi confirmado como salvo.')
      }
      const record={...clean(r),...(uploaded?{originalPath:uploaded}:{})}
      const revision=(r.cloudRevision??0)+1
      const payload={user_id:userId,id:r.id,filename:r.filename,record,revision}
      const request=r.cloudRevision
        ?client.from(IMPORT_TABLE).update(payload).eq('user_id',userId).eq('id',r.id).eq('revision',r.cloudRevision)
        :client.from(IMPORT_TABLE).insert(payload)
      const {data,error}=await request.select('id').maybeSingle()
      if(error||!data){
        if(uploaded)await client.storage.from(FILE_BUCKET).remove([uploaded])
        throw new Error('Não foi possível salvar. O arquivo pode ter sido alterado em outro dispositivo. Atualize o histórico e tente novamente.')
      }
      // Only after the database points to the new object may the old original be removed.
      if(uploaded&&r.originalPath&&r.originalPath!==uploaded)await client.storage.from(FILE_BUCKET).remove([r.originalPath])
      return {...record,cloudRevision:revision}
    },
    async remove(r:ImportRecord) {
      const {data,error}=await client.from(IMPORT_TABLE).delete().eq('user_id',userId).eq('id',r.id).eq('revision',r.cloudRevision??-1).select('id').maybeSingle()
      if(error||!data)throw new Error('O arquivo mudou ou não pôde ser excluído. Atualize o histórico.')
      if(r.originalPath){const {error:storageError}=await client.storage.from(FILE_BUCKET).remove([r.originalPath]);if(storageError)return 'O histórico foi excluído, mas a cópia original não pôde ser removida do armazenamento.'}
      return null
    },
    async download(r:ImportRecord) {
      if(!r.originalPath)throw new Error('Este registro não tem o XLSX original. Reimporte o arquivo para arquivá-lo na nuvem.')
      const {data,error}=await client.storage.from(FILE_BUCKET).download(r.originalPath)
      if(error||!data)throw new Error('Não foi possível baixar o arquivo original.')
      const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=r.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
    }
  }
}
