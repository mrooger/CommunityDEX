'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','background.js'),'utf8');
const release=(tag='v1.4.0')=>({tag_name:tag,html_url:`https://github.com/mrooger/CommunityDEX/releases/tag/${tag}`,assets:[{browser_download_url:`https://github.com/mrooger/CommunityDEX/releases/download/${tag}/Community-Dex-${tag}.zip`} ]});
function harness(data,status=200){
  let listener=null,requests=0;
  const chrome={runtime:{onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>({}),set:async()=>{}}}};
  const context={chrome,URL,Date,AbortController,fetch:async()=>{requests++;return {ok:status>=200&&status<300,status,json:async()=>data}} ,setTimeout,clearTimeout};
  vm.runInNewContext(source+'\n;globalThis.__test={parseRelease,getRelease}',context);
  return {context, get listener(){return listener},get requests(){return requests}};
}
function query(h,args={action:'check-update'}){return new Promise(resolve=>{
  const ret=h.listener(args,{url:'https://poke.idleworld.online/play'},resolve);
  assert.equal(ret,true);
});}
test('normaliza release com ZIP oficial do repo',()=>{
  const h=harness(release());const r=h.context.__test.parseRelease(release());
  assert.equal(r.version,'v1.4.0');
  assert.match(r.downloadUrl,/Community-Dex-v1\.4\.0\.zip$/);
});
test('rejeita URLs externas e tags inválidas',()=>{
  const h=harness(release());
  assert.throws(()=>h.context.__test.parseRelease({...release(),html_url:'https://evil.example/releases/tag/v1.4.0'}));
  assert.throws(()=>h.context.__test.parseRelease(release('branch-main')));
  const r=h.context.__test.parseRelease({...release(),assets:[{browser_download_url:'https://evil.example/payload.zip'}]});
  assert.equal(r.downloadUrl,'');
});
test('consulta e cacheia a última versão por 30 minutos',async()=>{
  const h=harness(release());
  assert.equal((await query(h)).version,'v1.4.0');
  assert.equal((await query(h)).version,'v1.4.0');
  assert.equal(h.requests,1);
  assert.equal((await query(h,{action:'check-update',force:true})).version,'v1.4.0');
  assert.equal(h.requests,2);
});
test('não aceita chamada de outra origem',async()=>{
 const h=harness(release());
 let r;const ok=h.listener({action:'check-update'},{url:'https://malicious.example/page'},v=>{r=v});
 assert.equal(ok,false);assert.equal(r.error,'Origem não permitida');assert.equal(h.requests,0);
});
test('falha de serviço mostra erro sem alterar o código da extensão',async()=>{
  const h=harness(release(),503);const response=await query(h);
  assert.match(response.error,/503/);
  assert.equal(response.url,'https://github.com/mrooger/CommunityDEX/releases');
});
