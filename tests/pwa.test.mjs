import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
test('install manifest points to valid PNG icons and standalone scope',()=>{
 const m=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'))
 assert.equal(m.display,'standalone');assert.equal(m.scope,'/');assert.equal(m.start_url,'/')
 for(const icon of m.icons){const b=readFileSync('public'+icon.src);const size=Number(icon.sizes.split('x')[0]);assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size)}
})
test('service worker never intercepts private API calls; offline navigation has a fallback',async()=>{
 const handlers={};let response
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),{URL,self:{location:{origin:'https://example.com'},addEventListener:(n,f)=>handlers[n]=f},fetch:async()=>{throw Error('offline')},caches:{match:async()=> 'offline-page'}})
 for(const request of [{method:'GET',mode:'cors',url:'https://example.supabase.co/rest/v1/ml_imports'},{method:'POST',mode:'cors',url:'https://example.com/api'},{method:'GET',mode:'cors',url:'https://example.com/private.json'}])handlers.fetch({request,respondWith:()=>assert.fail('Private API must not be intercepted')})
 handlers.fetch({request:{method:'GET',mode:'navigate',url:'https://example.com/'},respondWith:p=>response=p})
 assert.equal(await response,'offline-page')
})
