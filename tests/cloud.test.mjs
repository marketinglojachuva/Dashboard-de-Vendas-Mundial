import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
const temp=await mkdtemp(join(tmpdir(),'ml-cloud-'))
await build({entryPoints:['src/lib/cloudStorage.ts'],bundle:true,platform:'node',format:'cjs',outfile:join(temp,'lib.cjs')})
const {cloudStore}=(await import(pathToFileURL(join(temp,'lib.cjs')))).default
const r={version:1,id:'imp_a',filename:'vendas.xlsx',lines:[],label:'Vendas',periodStart:'2026-10-01',periodEnd:'2026-10-07'}
function fake({conflict=false,uploadError=false,list=[]}={}){
 const calls=[],removed=[]
 const storage={upload:async(path)=>{calls.push(['upload',path]);return {error:uploadError?new Error('upload'):null}},remove:async paths=>{removed.push(...paths);return{error:null}}}
 const client={storage:{from:()=>storage},from:()=>{
  const b={select:(...a)=>{calls.push(['select',...a]);return b},eq:(...a)=>{calls.push(['eq',...a]);return b},order:()=>b,range:async(a,z)=>{calls.push(['range',a,z]);return{data:list.slice(a,z+1),error:null}},insert:p=>{calls.push(['insert',p]);return b},update:p=>{calls.push(['update',p]);return b},delete:()=>{calls.push(['delete']);return b},maybeSingle:async()=>({data:conflict?null:{id:r.id},error:null})};return b
 }}
 return{client,calls,removed}
}
test('cloud save scopes data to authenticated user and retains a private original',async()=>{
 const f=fake();const out=await cloudStore(f.client,'user-a').save(r,new File(['bytes'],'vendas.xlsx'))
 assert.ok(out.originalPath.startsWith('user-a/imp_a/'));assert.equal(out.cloudRevision,1)
 const payload=f.calls.find(c=>c[0]==='insert')[1];assert.equal(payload.user_id,'user-a');assert.equal(payload.record.originalPath,out.originalPath);assert.ok(!('cloudRevision' in payload.record))
})
test('failed upload does not write a database row',async()=>{
 const f=fake({uploadError:true});await assert.rejects(()=>cloudStore(f.client,'user-a').save(r,new File(['bytes'],'a.xlsx')))
 assert.ok(!f.calls.some(c=>c[0]==='insert'))
})
test('stale revision is not reported as success; uploaded replacement is cleaned',async()=>{
 const f=fake({conflict:true});await assert.rejects(()=>cloudStore(f.client,'user-a').save({...r,cloudRevision:2,originalPath:'user-a/old'},new File(['bytes'],'a.xlsx')),/outro dispositivo/)
 assert.ok(f.calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===2));assert.equal(f.removed.length,1);assert.notEqual(f.removed[0],'user-a/old')
})
test('history pagination loads more than one API page with user filtering',async()=>{
 const rows=Array.from({length:201},(_,i)=>({id:String(i),record:{...r,id:String(i)},revision:3}));const f=fake({list:rows})
 const result=await cloudStore(f.client,'user-b').list();assert.equal(result.length,201);assert.equal(result[200].cloudRevision,3)
 assert.equal(f.calls.filter(c=>c[0]==='range').length,3);assert.equal(f.calls.filter(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='user-b').length,3)
})
test('delete requires the current revision',async()=>{
 const f=fake({conflict:true});await assert.rejects(()=>cloudStore(f.client,'user-a').remove({...r,cloudRevision:2,originalPath:'user-a/original'}));assert.equal(f.removed.length,0)
})
after(()=>rm(temp,{recursive:true,force:true}))
