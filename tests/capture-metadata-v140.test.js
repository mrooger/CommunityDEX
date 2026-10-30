'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const C=require('../core.js');
const L=require('../capture-log.js');
const M=require('../session.js');

function bridge(){
  const sent=[];
  class Socket {
    constructor(){this.listeners=new Map();}
    addEventListener(key,callback){if(!this.listeners.has(key))this.listeners.set(key,[]);this.listeners.get(key).push(callback);}
    receive(data){const event={data:JSON.stringify(data),target:this};for(const fn of this.listeners.get('message')||[])fn(event);}
  }
  const page={WebSocket:Socket,postMessage:(message)=>sent.push(message)};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main-bridge.js'),'utf8'),{window:page,location:{origin:'https://poke.idleworld.online'},WeakSet,Map,Proxy,Reflect,JSON,Date,TextDecoder,ArrayBuffer,Object,String,Number,console});
  return {socket:new page.WebSocket(),sent};
}

test('pokes: atualizações posteriores com IV são encaminhadas, sem duplicar snapshots',()=>{
  const {socket,sent}=bridge();
  socket.receive({type:'pokes',list:[{id:100,name:'Totodile',species:158,quality:null,ivTotal:null}]});
  assert.equal(sent.filter(m=>m.type==='capture-meta').length,0);
  socket.receive({type:'pokes',list:[{id:100,name:'Totodile',species:158,quality:1.552,ivTotal:143}]});
  let messages=sent.filter(m=>m.type==='capture-meta');
  assert.equal(messages.length,1);
  assert.equal(messages[0].payload.pokemon[0].quality,1.552);
  assert.equal(messages[0].payload.pokemon[0].ivTotal,143);
  socket.receive({type:'pokes',list:[{id:100,name:'Totodile',species:158,quality:1.552,ivTotal:143}]});
  assert.equal(sent.filter(m=>m.type==='capture-meta').length,1);
  socket.receive({type:'pokes',list:[{id:100,name:'Totodile',species:158,quality:1.552,ivTotal:145}]});
  messages=sent.filter(m=>m.type==='capture-meta');
  assert.equal(messages.length,2);
  assert.equal(messages.at(-1).payload.pokemon[0].ivTotal,145);
});

test('pokes: novo Pokémon é enviado sem retransmitir a coleção do inventário',()=>{
  const {socket,sent}=bridge();
  socket.receive({type:'pokes',list:[{id:4,name:'Charmander',quality:1.62,ivTotal:155}]});
  socket.receive({type:'pokes',list:[{id:4,name:'Charmander',quality:1.62,ivTotal:155},{id:5,name:'Growlithe',quality:1.8,ivTotal:164}]});
  const messages=sent.filter(m=>m.type==='capture-meta');
  assert.equal(messages.length,1);
  assert.equal(messages[0].payload.pokemon.length,1);
  assert.equal(messages[0].payload.pokemon[0].name,'Growlithe');
});

test('parser do jogo mantém qualidade Épica e IV mesmo em captura inicialmente incompleta',()=>{
  const ses=M.fresh(Date.now()-60000);
  M.addCapture(ses,{name:'Totodile',ball:'Ultra Ball',success:true,t:Date.now()-1000,rarity:null,quality:null,ivTotal:null});
  const raw={name:'Totodile',species:158,pokemonId:'p-01',quality:1.552,ivTotal:143};
  const detail=C.captureDetail(raw);
  assert.equal(detail.speciesId,158);
  assert.equal(detail.quality,1.552);
  assert.equal(detail.ivTotal,143);
  const link=L.chooseCapture({name:'totodile',pokemonId:raw.pokemonId,speciesId:detail.speciesId},ses.recentCaptures,Date.now());
  assert.equal(link,ses.recentCaptures[0]);
  Object.assign(link,detail);M.enrichCapture(ses,link);
  assert.equal(ses.recentCaptures[0].rarity,'Épico');
  assert.equal(ses.recentCaptures[0].ivTotal,143);
});

test('aba Capturas e Stream Geral começam com filtros recolhidos e expandem separadamente',()=>{
  const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  assert.match(app,/capturesFiltersExpanded:false,streamFiltersExpanded:false/);
  assert.match(app,/stream\?state\.streamFiltersExpanded:state\.capturesFiltersExpanded/);
  assert.match(app,/toggle-capture-filters/);
  assert.match(app,/toggle-stream-filters/);
  assert.match(app,/state\.capturesFiltersExpanded=!state\.capturesFiltersExpanded/);
  assert.match(app,/state\.streamFiltersExpanded=!state\.streamFiltersExpanded/);
});
