'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
const M=require('../session.js');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('rarity thresholds use official multiplier ranges',()=>{
 for(const [q,name] of [[.9,'Fraca'],[1,'Comum'],[1.1,'Incomum'],[1.3,'Raro'],[1.5,'Épico'],[1.7,'Lendário'],[2,'Mítica'],[3,'Anciã'],[4,'Divina']])assert.equal(M.rarity(null,q),name);
 assert.equal(M.rarity('Lendária',null),'Lendário');
 assert.equal(M.rarity(null,null),null);
});
test('capture filters hide only the unselected rarity, preserving all records and allowing none',()=>{
 const examples=[{name:'A',quality:1.05},{name:'B',quality:1.35},{name:'C',quality:1.8,shiny:true},{name:'D',quality:null}];
 assert.deepEqual(M.filterCaptures(examples,'all',['Raro']).map(c=>c.name),['B']);
 assert.deepEqual(M.filterCaptures(examples,'shiny',['Lendário']).map(c=>c.name),['C']);
 assert.deepEqual(M.filterCaptures(examples,'normal',['Comum','Não informada']).map(c=>c.name),['A','D']);
 assert.equal(M.filterCaptures(examples,'all',[]).length,0);
 assert.equal(examples.length,4);
});
test('IVs are extracted only from provided total or genuine 6-stat IV objects',()=>{
 const [a]=C.captureFrom({type:'catch-result',success:true,name:'Totodile',caughtPokemon:{quality:1.8,ivs:{hp:22,atk:25,def:20,spa:21,spd:23,spe:29},power:12530}});
 assert.equal(a.quality,1.8);assert.equal(a.ivTotal,140);assert.equal(a.power,12530);
 const [b]=C.captureFrom({type:'catch-result',success:true,name:'Totodile',caughtPokemon:{level:50,stats:{hp:250,atk:300}}});
 assert.equal(b.ivTotal,null);assert.equal(b.quality,null);
});
test('best capture and manual report include genuinely observed quality and IV',()=>{
 const s=M.fresh(1000);
 M.addCapture(s,{success:true,name:'Totodile',ball:'Ultra Ball',t:1100,quality:1.5,ivTotal:100});
 M.addCapture(s,{success:true,name:'Totodile',ball:'Ultra Ball',t:1200});
 assert.equal(s.bestCapture.ivTotal,100);
 const last=s.recentCaptures[0];assert.equal(last.ivTotal,undefined);
 M.enrichCapture(s,{...last,quality:1.8,ivTotal:140,rarity:'Lendário'});
 assert.equal(s.bestCapture.ivTotal,140);
 assert.equal(M.snapshot(s,2000,'manual').bestCapture.name,'Totodile');
 assert.equal(s.captures,2);
});
test('bridge forwards sanitized newly obtained Pokemon, never old roster or account secrets',()=>{
 const sent=[];
 class Socket{constructor(){this.listeners=new Map();}addEventListener(name,cb){this.listeners.set(name,cb);}emit(data){this.listeners.get('message')({data});}}
 const page={WebSocket:Socket,postMessage:x=>sent.push(x)};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main-bridge.js'),'utf8'),{window:page,location:{origin:'https://poke.idleworld.online'},WeakSet,Proxy,Reflect,JSON,Date,TextDecoder,ArrayBuffer,Object,String,Set});
 const ws=new page.WebSocket('wss://game');
 ws.emit(JSON.stringify({type:'pokes',list:[{id:'a',name:'Totodile',quality:1.1,password:'NO'}]}));
 assert.equal(sent.filter(x=>x.type==='capture-meta').length,0);
 ws.emit(JSON.stringify({type:'pokes',list:[{id:'a',name:'Totodile',quality:1.1},{id:'b',name:'Totodile',quality:1.8,ivs:{hp:22,atk:25,def:20,spa:21,spd:23,spe:29},password:'NO'}]}));
 const meta=sent.filter(x=>x.type==='capture-meta');assert.equal(meta.length,1);
 assert.equal(meta[0].payload.pokemon.length,1);assert.equal(meta[0].payload.pokemon[0].name,'Totodile');
 assert(!JSON.stringify(meta).includes('password'));assert(!JSON.stringify(meta).includes('NO'));
 ws.emit(JSON.stringify({type:'pokes',list:[{id:'a',name:'Totodile'},{id:'b',name:'Totodile'}]}));
 assert.equal(sent.filter(x=>x.type==='capture-meta').length,1);
});
