import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { build } from 'esbuild'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
const temp=await mkdtemp(join(tmpdir(),'ml-tests-'))
await build({stdin:{contents:"export * from './src/lib/analytics'; export * from './src/lib/periods'; export * from './src/lib/parseMercadoLivre';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'cjs',outfile:join(temp,'lib.cjs')})
const api=(await import(pathToFileURL(join(temp,'lib.cjs')))).default
const {buildPeriods,consolidate,compareAds,dailySeries,summarize,parseSalesBuffer,latestCompleteDate}=api
const line=(id,date,units=1,extra={})=>({saleId:id,date:`${date}T12:00`,adId:'MLB1',sku:'SKU1',title:'Produto',units,gross:units*10,unitPrice:10,net:units*8,fee:-units*2,shipping:0,status:'valid',statusText:'Entregue',stage:'delivered',uf:'SP',sponsored:false,listingType:'Clássico',inPack:false,...extra})
const record=(lines,extra={})=>({version:1,parserVersion:3,id:'a',filename:'teste.xlsx',importedAt:'2026-10-16T15:00',exportedAt:'2026-10-16T14:11',periodStart:'2026-08-01',periodEnd:'2026-10-16',label:'Teste',rowsRead:lines.length,warnings:[],lines,...extra})
test('7 vs 7: quantities are exact and dates are inclusive',()=>{
 const p=buildPeriods([record([line('a','2026-10-02',10),line('b','2026-10-08',10),line('c','2026-10-09',5),line('d','2026-10-15',3),line('e','2026-10-16',99)])],'2026-10-09','2026-10-15')
 assert.equal(p.previousStart,'2026-10-02'); assert.equal(p.previousEnd,'2026-10-08')
 const row=compareAds(p.current,p.previous,{threshold:20})[0]
 assert.equal(row.prev.units,20);assert.equal(row.cur.units,8);assert.equal(row.unitsDelta,-12);assert.equal(row.changePct,-60)
})
test('all presets have equal windows and never prorate',()=>{
 for(const n of [7,15,30]){const end='2026-10-15',start=api.addDays(end,1-n),p=buildPeriods([record([])],start,end);assert.equal(api.periodDays(p.current),n);assert.equal(api.periodDays(p.previous),n)}
 assert.throws(()=>compareAds(record([]),record([],{periodStart:'2026-10-01'}),{threshold:20}),/mesma/)
})
test('overlapping exports do not double count; newest export wins even if older imported later',()=>{
 const old=record([line('a','2026-10-10',2)],{exportedAt:'2026-10-11T12:00',importedAt:'2026-10-18T12:00'})
 const fresh=record([line('a','2026-10-10',2,{status:'cancelled'})])
 const merged=consolidate([fresh,old]);assert.equal(merged.lines.length,1);assert.equal(merged.duplicates,1);assert.equal(merged.lines[0].status,'cancelled')
})
test('missing coverage disables comparison; partial export day is not a full day',()=>{
 const r=record([],{periodStart:'2026-10-09'})
 assert.equal(latestCompleteDate([r]),'2026-10-15')
 const p=buildPeriods([r],'2026-10-09','2026-10-15');assert.ok(p.current);assert.equal(p.previous,null);assert.equal(p.previousMissing.length,7)
 assert.equal(buildPeriods([r],'2026-10-10','2026-10-16').current,null)
})
test('interior uncovered dates stay missing; covered zero-sales days are zero',()=>{
 const p=buildPeriods([record([],{periodStart:'2026-10-01',periodEnd:'2026-10-03'}),record([],{periodStart:'2026-10-05',periodEnd:'2026-10-07'})],'2026-10-01','2026-10-07')
 assert.deepEqual(p.currentMissing,['2026-10-04']);assert.equal(p.current,null)
 const complete=buildPeriods([record([])],'2026-10-01','2026-10-07');assert.equal(summarize(complete.current).units,0);assert.equal(dailySeries(complete.current,null).length,7)
})
test('invalid dates, overlap and long intervals fail explicitly',()=>{
 assert.ok(buildPeriods([],'2026-02-30','2026-03-07').error)
 assert.ok(buildPeriods([],'2026-10-09','2026-10-15','2026-10-09').error)
 assert.ok(buildPeriods([],'2020-01-01','2026-10-15').error)
})
test('products that stopped selling remain with negative unit delta; zero baseline has no invented percent',()=>{
 const p=buildPeriods([record([line('a','2026-10-03',4),line('b','2026-10-10',6,{adId:'MLB2'})])],'2026-10-09','2026-10-15')
 const r=compareAds(p.current,p.previous,{threshold:20})
 assert.equal(r.find(r=>r.adId==='MLB1').unitsDelta,-4);assert.equal(r.find(r=>r.adId==='MLB1').changePct,-100)
 assert.equal(r.find(r=>r.adId==='MLB2').changePct,null)
})
test('multi-line IDs do not inflate ticket denominator',()=>{
 const t=summarize(record([line('a','2026-10-10',1),line('a','2026-10-10',1,{adId:'MLB2'})]))
 assert.equal(t.orders,1);assert.equal(t.ticket,20)
})
if(process.env.ML_FIXTURE){
 test('real workbook: totals reconcile, private buyer fields discarded, all presets supported',async()=>{
  const bytes=await readFile(process.env.ML_FIXTURE)
  const r=parseSalesBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'fixture.xlsx')
  assert.equal(r.periodStart,'2026-08-16');assert.equal(r.periodEnd,'2026-10-16');assert.equal(r.lines.length,4423)
  assert.ok(r.lines.every(l=>!('buyer' in l)&&!('cpf' in l)&&!('address' in l)))
  for(const n of [7,15,30]){const p=buildPeriods([r],api.addDays('2026-10-15',1-n),'2026-10-15');assert.ok(p.current);assert.ok(p.previous);const a=compareAds(p.current,p.previous,{threshold:20});assert.equal(a.reduce((s,x)=>s+x.cur.units,0),summarize(p.current).units);assert.equal(a.reduce((s,x)=>s+x.prev.units,0),summarize(p.previous).units)}
  const month={...r,id:'month',periodStart:'2026-09-16',lines:r.lines.filter(l=>l.date>='2026-09-16')}
  const week={...r,id:'week',periodStart:'2026-10-09',lines:r.lines.filter(l=>l.date>='2026-10-09')}
  const merged=buildPeriods([r,month,week],'2026-10-09','2026-10-15')
  assert.equal(summarize(merged.current).units,summarize(buildPeriods([r],'2026-10-09','2026-10-15').current).units)
  assert.equal(summarize(merged.previous).units,summarize(buildPeriods([r],'2026-10-09','2026-10-15').previous).units)
  assert.ok(merged.duplicates>0)
  assert.ok(r.lines.filter(l=>/Devolvido/i.test(l.statusText)).every(l=>l.status==='returned'))
  const p=buildPeriods([r],'2026-10-09','2026-10-15')
  console.log('REAL WORKBOOK',JSON.stringify({lines:r.lines.length,current:summarize(p.current),previous:summarize(p.previous),warnings:r.warnings}))
  // Independent raw control: summaries have amounts; their child rows have blanks.
  const XLSX=await import('xlsx');const wb=XLSX.read(bytes,{type:'buffer'});const raw=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''}).slice(6)
  // Independent source controls: explicit original status labels and raw dates,
  // without calling the application's classification/date helpers.
  const accepted=new Set(['Entregue','A caminho','Anúncio sem dados fiscais','Pronta para emitir NF-e da venda','Venda entregue','Mediação finalizada. Te demos o dinheiro.','Mediação finalizada. Te demos o dinheiro','No ponto de retirada','Envio atrasado','Envio reagendado','O envio está atrasado, mas o dinheiro já está disponível para você','Processando no centro de distribuição','Venda concretizada','Pacote não entregue','Liberamos o dinheiro da venda para você e reembolsamos o comprador'])
  const sourceRows=raw.filter(l=>accepted.has(l[3])||String(l[3]).startsWith('Para entregar na coleta do dia ')||String(l[3]).startsWith('Vamos enviar o pacote no dia '))
  const monthIndex={agosto:'08',setembro:'09',outubro:'10'}
  for(const n of [7,15,30]){
    const periods=buildPeriods([r],api.addDays('2026-10-15',1-n),'2026-10-15')
    for(const period of [periods.current,periods.previous]){
      const expected=new Map()
      for(const l of sourceRows){const m=l[1].match(/(\d+) de (\w+) de (\d{4})/);assert.ok(m);const date=`${m[3]}-${monthIndex[m[2]]}-${m[1].padStart(2,'0')}`;if(date>=period.periodStart&&date<=period.periodEnd)expected.set(l[23],(expected.get(l[23])??0)+l[7])}
      const actual=new Map(compareAds(period,null,{threshold:20}).filter(x=>x.cur.units).map(x=>[x.adId,x.cur.units]))
      assert.deepEqual([...actual].sort(),[...expected].sort())
    }
  }
  for(const [col,key] of [[8,'gross'],[11,'fee'],[18,'net'],[17,'refund']]){
   const expected=raw.reduce((s,l)=>s+(typeof l[col]==='number'?l[col]:0),0)
   const actual=r.lines.reduce((s,l)=>s+(l[key]??0),0)
   assert.ok(Math.abs(expected-actual)<0.01,`${key}: ${expected} vs ${actual}`)
  }
 })
}
after(()=>rm(temp,{recursive:true,force:true}))

const XLSX=await import('xlsx')
const headers=['N.º de venda','Data de venda','Estado','Unidades','Receita por produtos (BRL)','Tarifa de venda e impostos (BRL)','Receita por envio (BRL)','Tarifas de envio (BRL)','Total (BRL)','# de anúncio','Título do anúncio','Preço unitário de venda do anúncio (BRL)','SKU']
const cells=(id='100',extra={})=>Object.assign([id,'10 de outubro de 2026 12:00 hs.','Entregue',2,20,-2,0,-3,15,'MLB1','Produto',10,'SKU1'],extra)
function makeWorkbook(data,{columns=headers,reverse=false,cover=false,meta=true}={}){
 let rows=[[meta?'Status em 16 de outubro de 2026, às 14:11 hs.':'Relatório'],columns.map(()=> 'Vendas'),columns,...data]
 if(reverse)rows=rows.map((row,i)=>i===0?row:[...row].reverse())
 const wb=XLSX.utils.book_new();if(cover)XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Capa']]),'Capa')
 XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(rows),'Vendas BR')
 return XLSX.write(wb,{type:'array',bookType:'xlsx'})
}
test('compatible exports: reordered columns, cover tab and additional columns',()=>{
 const a=parseSalesBuffer(makeWorkbook([cells()]),'one.xlsx')
 const b=parseSalesBuffer(makeWorkbook([[...cells(),'extra']],{columns:[...headers,'Nova coluna'],reverse:true,cover:true}),'two.xlsx')
 assert.deepEqual(summarize(a),summarize(b));assert.equal(b.parserVersion,3)
})
test('compatible exports: Excel date serial and Brazilian currency strings',()=>{
 const r=parseSalesBuffer(makeWorkbook([cells('100',{1:46305,4:'R$ 1.234,56',8:'R$ 1.229,56'})]),'numbers.xlsx')
 assert.equal(r.lines[0].gross,1234.56);assert.equal(r.lines[0].net,1229.56)
})
test('reject missing critical column instead of importing zeros',()=>{
 assert.throws(()=>parseSalesBuffer(makeWorkbook([cells()],{columns:headers.map(h=>h==='Receita por produtos (BRL)'?'Outra receita':h)}),'bad.xlsx'),/Faltam colunas/)
})
test('reject invalid dates, malformed money, missing IDs, unsafe numeric IDs and duplicate rows',()=>{
 for(const data of [[cells('100',{1:'31 de fevereiro de 2026'})],[cells('100',{4:'erro'})],[cells('100',{4:'1,234.56'})],[cells('',{})],[cells(20000190161850100)],[cells(),cells()]])assert.throws(()=>parseSalesBuffer(makeWorkbook(data),'bad.xlsx'))
})
test('reject unknown status and missing export timestamp; no silent omission',()=>{
 assert.throws(()=>parseSalesBuffer(makeWorkbook([cells('100',{2:'Novo status desconhecido'})]),'bad.xlsx'),/não reconhecido/)
 assert.throws(()=>parseSalesBuffer(makeWorkbook([cells()],{meta:false}),'bad.xlsx'),/data de geração/)
})
test('package amounts reconcile to cents and incomplete/orphan packages are blocked',()=>{
 const pack=cells('p',{2:'Pacote de 2 produtos',3:'',4:10.01,5:-1.01,7:-2.01,8:6.99,9:'',10:'',11:''})
 const a=cells('a',{3:1,4:'',5:'',7:'',8:'',11:3}),b=cells('b',{3:1,4:'',5:'',7:'',8:'',11:7})
 const r=parseSalesBuffer(makeWorkbook([pack,a,b]),'pack.xlsx')
 assert.equal(r.lines.reduce((s,l)=>s+Math.round(l.gross*100),0),1001)
 assert.equal(r.lines.reduce((s,l)=>s+Math.round(l.net*100),0),699)
 assert.throws(()=>parseSalesBuffer(makeWorkbook([pack,a]),'bad.xlsx'),/Pacote incompleto/)
 assert.throws(()=>parseSalesBuffer(makeWorkbook([a]),'bad.xlsx'),/sem faturamento/)
})
test('older parser records do not enter reviewed calculations',()=>{
 assert.equal(buildPeriods([record([line('a','2026-10-10',100)],{parserVersion:2})],'2026-10-09','2026-10-15').current,null)
})
