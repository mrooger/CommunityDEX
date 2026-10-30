'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../capture-log.js');
const M=require('../session.js');
const C=require('../core.js');
const here=path.join(__dirname,'..');

test('lê raridade, multiplicador e IV exibidos no Log de Capturas do jogo',()=>{
  const row={
    innerText:'Totodile\nLendária · ×1,800 · IV 140/192',
    querySelector(selector){
      if(selector.includes('clog-meta'))return {innerText:'Lendária · ×1,800 · IV 140/192'};
      if(selector.includes('clog-name'))return {textContent:'Totodile'};
    },dataset:{}
  };
  assert.deepEqual(L.parseRow(row),{rarity:'Lendário',quality:1.8,ivTotal:140,ivMax:192,name:'Totodile',pokemonId:null,spriteUrl:null,clock:null,clockPrecision:null});
  assert.deepEqual(L.extract('Swellow\nRara · IV 88','Rara · IV 88'),{rarity:'Raro',quality:null,ivTotal:88,ivMax:192});
  assert.equal(L.extract('Pokémon sem metadados').ivTotal,null);
});
test('correlaciona Log de Capturas somente quando o exemplar é identificável',()=>{
  const at=Date.now();
  const caps=[{name:'Totodile',success:true,t:at-5000,pokemonId:null},{name:'Swellow',success:true,t:at-4000}];
  assert.equal(L.chooseCapture({name:'Totodile'},caps,at),caps[0]);
  assert.equal(L.chooseCapture({name:'Totodile'},[...caps,{name:'Totodile',success:true,t:at-6000}],at),null);
  assert.equal(L.chooseCapture({name:'Aggron'},caps,at),null);
  assert.equal(L.chooseCapture({name:''},caps,at),null);
  assert.equal(L.chooseCapture({name:'Totodile',clock:'04:22:30'},caps,at),null);
});
test('raridade e IV extraídos alimentam captura e melhor exemplar sem nova captura',()=>{
  const s=M.fresh(1000),t=Date.now();
  const capture={name:'Totodile',ball:'Great Ball',success:true,t};
  M.addCapture(s,capture);
  const data=L.extract('Totodile Lendária ×1.800 IV 140/192');
  const matched=L.chooseCapture({name:'Totodile',...data},s.recentCaptures,t);
  assert.ok(matched);
  Object.assign(matched,data);
  M.enrichCapture(s,matched);
  assert.equal(s.captures,1);
  assert.equal(s.bestCapture.ivTotal,140);
  assert.equal(s.bestCapture.rarity,'Lendário');
});
test('Stream passa de 15% a 20% sem ficar presa à média acumulada de toda a sessão',()=>{
  const at=Date.now(),kills=[];
  for(let i=0;i<300;i++)kills.push({t:at-(300-i)*1200,parts:{base:1000,vip:500,stream:150}});
  for(let i=0;i<9;i++)kills.push({t:at-(9-i)*1200,parts:{base:1000,vip:500,stream:200}});
  const latest=M.currentBonuses(kills,at);
  assert.equal(latest.find(k=>k.key==='stream').rate,20);
  assert.equal(latest.find(k=>k.key==='vip').rate,50);
  assert(Math.round(kills.reduce((s,k)=>s+k.parts.stream,0)/kills.reduce((s,k)=>s+k.parts.base,0)*100)<20);
  assert.equal(M.currentBonuses([{t:at,parts:{base:1000,stream:175}}],at)[0].rate,17.5);
  assert.deepEqual(M.currentBonuses([],at),[]);
});
test('v1.4.0 preservada, fontes de captura e bônus recentes registradas',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(here,'manifest.json'),'utf8'));
  assert.equal(manifest.version,'1.4.0');
  assert(manifest.content_scripts.some(c=>c.js?.includes('capture-log.js')));
  const app=fs.readFileSync(path.join(here,'app.js'),'utf8');
  assert(app.includes('.clog-window .clog-row'));
  assert(app.includes('M.currentBonuses(state.kills,now())'));
  assert(app.includes('Versão v1.4.0'));
  assert(C.captureDetail({ivTotal:140,quality:1.8}).ivTotal===140);
});

test('identifica Épica com acento inicial e normaliza para Épico',()=>{
  for(const name of ['Épica','ÉPICA','Epica','Épico','Epic']){
    const data=L.extract('Totodile · '+name+' · IV 138/192');
    assert.equal(data.rarity,'Épico',name);
    assert.equal(M.rarity(data.rarity,data.quality),'Épico');
  }
  assert.equal(M.rarity('Épica',null),'Épico');
});

test('ordena capturas por maior IV, maior raridade ou mais recente, sem perder registros',()=>{
  const captures=[
    {name:'A',t:1,rarity:'Épica',ivTotal:145},
    {name:'B',t:3,rarity:'Comum',ivTotal:100},
    {name:'C',t:2,rarity:'Lendária',ivTotal:135},
    {name:'D',t:4,rarity:null,ivTotal:null}
  ];
  const source=captures.map(x=>x.name).join();
  assert.deepEqual(M.sortCaptures(captures,'iv').map(x=>x.name),['A','C','B','D']);
  assert.deepEqual(M.sortCaptures(captures,'rarity').map(x=>x.name),['C','A','B','D']);
  assert.deepEqual(M.sortCaptures(captures,'recent').map(x=>x.name),['D','B','C','A']);
  assert.equal(captures.map(x=>x.name).join(),source);
  assert.deepEqual(M.filterCaptures(captures,'all',['Épico']).map(x=>x.name),['A']);
});

test('painéis recolhíveis e histórico preservam configuração da v1.4.0',()=>{
  const app=fs.readFileSync(path.join(here,'app.js'),'utf8');
  for(const key of ['pokemonTypes','capturesBalls','shinyDetector']){
    assert(app.includes(key+':false'));
    assert(app.includes("expandable('"+key+"'"));
  }
  for(const key of ['activity','pokemon-history','loot','shinies','captures']){
    assert(app.includes('data-scroll-id="'+key+'"')||(key==='captures'&&app.includes('const scrollId=stream?')));
  }
  assert(app.includes('listPositions.get(el.dataset.scrollId)'));
  assert(app.includes('data-capture-kind'));
  assert(app.includes('data-capture-sort'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(here,'manifest.json'))).version,'1.4.0');
});
