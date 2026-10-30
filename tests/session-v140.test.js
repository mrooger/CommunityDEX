'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const M=require('../session.js');const C=require('../core.js');
const start=Date.UTC(2026,9,25,8);
test('more than 30,000 kills counted without accumulating an unbounded record array',()=>{
 const s=M.fresh(start);for(let i=0;i<50000;i++)M.addKill(s,{xp:150,parts:{base:100,vip:50},loot:[]});
 assert.equal(s.kills,50000);assert.equal(s.xp,7500000);assert.equal(s.parts.vip,2500000);assert(!('killsHistory' in s));
 const log=M.snapshot(s,start+M.DAY);assert.equal(log.summary.kills,50000);assert.equal(log.summary.killsHour,Math.round(50000/24));
});
test('all captures count, only latest 200 successes stored, shiny capture is separate from encounter',()=>{
 const s=M.fresh(start);for(let i=0;i<44000;i++){M.addCapture(s,{success:i%5===0,shiny:i%500===0,name:'Pikachu',ball:'Ultra Ball',t:start+i,quality:1.5,ivTotal:100});}
 assert.equal(s.attempts,44000);assert.equal(s.captures,8800);assert.equal(s.shinyCaptures,88);assert.equal(s.recentCaptures.length,200);assert.equal(s.shinyEncounters,0);
 M.addShiny(s,{name:'Swellow',t:start+10,position:'1:2'});assert.equal(s.shinyEncounters,1);
});
test('automatic 24h rollover creates log and resets without discarding the saved daily report',()=>{
 const s=M.fresh(start);M.addKill(s,{xp:24000,parts:{base:20000,vip:4000},loot:[]});M.addCapture(s,{success:true,shiny:true,name:'Totodile',t:start+100});
 const first=M.rotate(s,start+M.DAY-1);assert.equal(first.closed,null);assert.equal(first.session,s);
 const after=M.rotate(s,start+M.DAY);assert.equal(after.closed.summary.kills,1);assert.equal(after.closed.summary.shinyCaptures,1);assert.equal(after.session.kills,0);assert.equal(after.closed.endAt,start+M.DAY);
});
test('manual reports are snapshots: they do not zero the active session',()=>{
 const s=M.fresh(start);M.addKill(s,{xp:900,loot:[]});const report=M.snapshot(s,start+3600000,'manual');assert.equal(report.kind,'manual');assert.equal(report.summary.xpHour,900);assert.equal(s.kills,1);
});
test('daily logs older than 5 days removed, 5 recent manual logs retained',()=>{
 const at=start+9*M.DAY;const logs=Array.from({length:10},(_,i)=>({...M.snapshot(M.fresh(start+i*M.DAY),start+(i+1)*M.DAY,'daily'),createdAt:start+(i+1)*M.DAY}));
 const recent=M.prune(logs,'daily',at);assert(recent.length<=5);assert(recent.every(x=>at-x.endAt<=5*M.DAY));
 const manual=logs.map((log,i)=>({...log,kind:'manual',createdAt:start+i*1000}));assert.equal(M.prune(manual,'manual',at).length,5);
});
test('rarity normalized by label or quality while unknown values remain unknown',()=>{
 assert.equal(M.rarity('Épico',null),'Épico');assert.equal(M.rarity('rare',null),'Raro');assert.equal(M.rarity(null,1.55),'Épico');assert.equal(M.rarity(null,null),null);
});
test('VIP +50% and stream +15% rates use XP base, not total',()=>{
 const b=M.bonuses({base:10000,vip:5000,stream:1500});assert.equal(b.find(x=>x.key==='vip').rate,50);assert.equal(b.find(x=>x.key==='stream').rate,15);
});
test('captures parser extracts real optional IV, rarity and shiny without guessing missing fields',()=>{
 let [c]=C.captureFrom({type:'catch-result',speciesName:'Swellow',ball:'Ultra Ball',success:true,quality:1.78,ivTotal:136,shiny:true});
 assert.equal(c.ivTotal,136);assert.equal(c.quality,1.78);assert.equal(c.shiny,true);
 [c]=C.captureFrom({type:'catch-result',speciesName:'Aggron',success:true});assert.equal(c.ivTotal,null);assert.equal(c.quality,null);
});
test('preserves existing v1.3.0 records in a partial migration explicitly marked',()=>{
 const s=M.fromLegacy([{xp:100,parts:{base:100},loot:[]}],[{success:true,name:'Pikachu'}],[{name:'Totodile',t:start}],start);assert.equal(s.partial,true);assert.equal(s.kills,1);assert.equal(s.captures,1);assert.equal(s.shinyEncounters,1);
});
