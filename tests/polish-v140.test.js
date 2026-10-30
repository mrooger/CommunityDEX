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
  assert.deepEqual(L.parseRow(row),{rarity:'Lendário',quality:1.8,ivTotal:140,ivMax:192,name:'Totodile',pokemonId:null,clock:null,clockPrecision:null});
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
  assert(app.includes('.clog-window .clog-list .clog-row'));
  assert(app.includes('M.currentBonuses(state.kills,now())'));
  assert(app.includes('Versão v1.4.0'));
  assert(C.captureDetail({ivTotal:140,quality:1.8}).ivTotal===140);
});
