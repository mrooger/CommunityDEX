const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');

test('recognizes tooltip with known name, 6 attributes, level and quality',()=>{
 const p=C.parseTooltip('Lv. 100  Quality Lendária ×1.80  IV 121/192\nHP: 300\nAtk 240\nDef 210\nSpA: 250\nSpD 180\nVel 200','Arcanine','Fire');
 assert.equal(p.name,'Arcanine');assert.equal(p.level,100);assert.equal(p.quality,1.8);assert.equal(p.stats.atk,240);assert.equal(p.ivTotal,121);assert.deepEqual(p.types,['fire']);
});
test('manual parser can preserve the species header',()=>{
 const p=C.parseTooltip('Gyarados\nLv 100\nHP 600\nAtk 300\nDef 200\nSpA 200\nSpD 200\nSpeed 320');assert.equal(p.name,'Gyarados');
});
test('rejects incomplete tooltip',()=>{assert.equal(C.parseTooltip('Pikachu LV 1 HP 100'),null)});
test('type matrix handles immunities and double weakness',()=>{
 const m=C.typeMatrix(['flying','water']);assert.equal(m.weak.find(x=>x.type==='electric').mult,4);
 assert.equal(C.typeMatrix(['ground']).immune.find(x=>x.type==='electric').mult,0);
});
test('estimates attributes by model with a 32 max',()=>{
 const base={hp:80,atk:90,def:80,spa:90,spd:80,spe:95},level=100,quality=1.8,stat={};
 for(const [k,b] of Object.entries(base)){const exp=['hp','spe'].includes(k)?.95:.8;stat[k]=Math.round((b+2*20)*(level/100)*Math.pow(quality,exp));}
 const r=C.estimateIV({level,quality,stats:stat},base,32);assert.equal(r.total,120);assert.equal(r.count,6);
});
test('XP curve starts at zero and grows',()=>{assert.equal(C.xpForLevel(1),0);assert.equal(C.xpForLevel(2),100);assert(C.xpForLevel(100)>C.xpForLevel(90));});
test('parse shiny mob in a field packet',()=>{
 const events=C.shinyFrom({type:'field',mobs:[{id:'a',shiny:true,speciesName:'Charmander',row:1,col:2,hp:200},{id:'b',shiny:true,dead:true}]});
 assert.equal(events.length,1);assert.equal(events[0].name,'Charmander');
});
test('parse capture results, keep non-capture packets excluded',()=>{
 assert.equal(C.captureFrom({type:'field-kill',success:true}).length,0);
 const [x]=C.captureFrom({type:'catch-result',speciesName:'Arcanine',ballName:'Ultra Ball',success:true});assert.equal(x.success,true);assert.equal(x.ball,'Ultra Ball');
});
test('parse XP and loot without network',()=>{
 const [x]=C.killFrom({type:'field-kill',xpGained:1000,totalXp:15000,level:12,loot:[{name:'Feather',qty:2}],xpParts:{base:800,vip:200}});
 assert.equal(x.xp,1000);assert.equal(x.loot[0].qty,2);
});
test('parses SpA and SpD abbreviations from game tooltip',()=>{
 const p=C.parseTooltip('Lv 100 Quality x1.80 IV 120/192 HP 350 Atk 260 Def 220 SpA 241 SpD 229 Vel 230','Arcanine','Fire');
 assert.equal(p.stats.spa,241);assert.equal(p.stats.spd,229);
});
test('escapes data from game packets',()=>{assert.equal(C.escape('<script>alert(1)</script>'),'&lt;script&gt;alert(1)&lt;/script&gt;')});

test('recognizes compact real-world tooltip without separators (IV to HP and stat to stat)',()=>{
 const p=C.parseTooltip('Lv100Quality Lendária ×1.80IV137/192HP1009Atk847Def621SpA788SpD633Spd710','Arcanine','Fire');
 assert.ok(p,'tooltip parsed');
 assert.equal(p.level,100);assert.equal(p.ivTotal,137);assert.equal(p.quality,1.8);
 assert.deepEqual(p.stats,{hp:1009,atk:847,def:621,spa:788,spd:633,spe:710});
});
test('supports Nv shorthand, Spd speed and SpD special defense separately',()=>{
 const p=C.parseTooltip('Nv. 85 | Raridade Épica ×1,55 | HP 317 Atk 223 Def 186 SpA 211 SpD 175 Spd 194','Arcanine','Fire');
 assert.ok(p);assert.equal(p.level,85);assert.equal(p.quality,1.55);
 assert.equal(p.stats.spe,194);assert.equal(p.stats.spd,175);
});
test('does not confuse SpAtk with physical Atk',()=>{
 const p=C.parseTooltip('Lv 85 Quality ×1.55 HP 317 SpAtk 211 SpDef 175 Spd 194 Atk 223 Def 186','Arcanine','Fire');
 assert.ok(p);assert.equal(p.stats.atk,223);assert.equal(p.stats.spa,211);
});
