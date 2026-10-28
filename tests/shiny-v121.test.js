const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');

test('seven reports of one live Swellow produce one encounter, even with drifting coordinates and different IDs',()=>{
 const detector=C.createShinyEncounterTracker();
 let notifications=0;
 const packets=[
  {type:'field',mobs:[{speciesId:277,shiny:true,row:3,col:5,hp:30,id:12}]},
  {type:'field',mobs:[{speciesName:'Swellow',shiny:true,row:3,col:5,hp:30,slot:7}]},
  {type:'field',mobs:[{species:277,shiny:true,row:4,col:5,hp:20,id:13}]},
  {type:'map-update',entities:[{speciesId:277,shiny:true,row:4,col:6,hp:20,mobId:987}]},
  {type:'field',mobs:[{speciesName:'Swellow',shiny:true,row:4,col:6,hp:20,mobId:987}]},
  {type:'field',mobs:[{speciesId:277,shiny:true,row:4,col:6,hp:10}]},
  {type:'spawn',mobs:[{speciesId:277,shiny:true,row:4,col:7,hp:10}]},
 ];
 packets.forEach((packet,i)=>C.shinyFrom(packet).forEach(e=>{if(detector.observe(e,1700000000000+i*20000).isNew)notifications++;}));
 assert.equal(notifications,1);
 assert.equal(detector.size,1);
});
test('the same visible encounter does not alert again after 30 seconds and can be primed after reload',()=>{
 const a=C.createShinyEncounterTracker(),b=C.createShinyEncounterTracker();
 const start=Date.now();
 const event={name:'Aggron',speciesId:306,position:'12:4',t:start};
 assert.equal(a.observe(event,start).isNew,true);
 assert.equal(a.observe({...event,position:'15:8',entityId:'new-id'},start+35000).isNew,false);
 b.prime([event],start+90000);
 assert.equal(b.observe({...event,position:'20:19'},start+90000).isNew,false);
});
test('non-map messages must never register as new Shinies',()=>{
 for(const type of ['inventory','pokes','party','character','catch-result','capture-result','field-kill','poke-xp','market']){
  assert.deepEqual(C.shinyFrom({type,mobs:[{speciesId:158,shiny:true,row:3,col:4,hp:3}],speciesId:158,shiny:true,row:3,col:4,hp:3}),[],type);
 }
});
test('a second shiny of another species is a separate encounter; a later respawn may be new',()=>{
 const d=C.createShinyEncounterTracker({cooldownMs:30000,positionCooldownMs:60000});
 const a={name:'Swellow',speciesId:277,position:'2:3',t:1000};
 const b={name:'Aggron',speciesId:306,position:'2:3',t:1001};
 assert(d.observe(a,1000).isNew);
 assert(d.observe(b,1001).isNew);
 assert(!d.observe(a,20000).isNew);
 assert(d.observe(a,100000).isNew);
});
test('migrate seven numeric-and-named records from the same burst into one without removing later encounter',()=>{
 const start=Date.now();
 const history=[];
 for(let i=0;i<7;i++)history.push({name:i%2?'Swellow':'277',position:`${4+i}:${7+i}`,t:start-i*1500});
 history.push({name:'277',position:'99:99',t:start-3600000});
 const clean=C.normalizeShinyHistory(history);
 assert.equal(clean.length,2);
 assert.equal(clean[0].name,'Swellow');
});
test('a map packet containing a shiny and a player owned shiny should not read a nested inventory list as field spawns',()=>{
 const packet={type:'field',mobs:[{speciesId:158,shiny:true,row:3,col:4,hp:10}],inventory:[{speciesId:6,shiny:true,row:3,col:4,hp:10}]};
 // Inventory not traversed by packetNodes, only field/map collections.
 const items=C.shinyFrom(packet);
 assert.deepEqual(items.map(x=>x.name),['Totodile']);
});

test('field packet ignores nested party Pokémon although they are shiny',()=>{
 const pkt={type:'field',mobs:[{speciesId:158,shiny:true,row:3,col:4,hp:10}],pokemons:[{speciesId:6,shiny:true,row:3,col:4,hp:10}]};
 assert.deepEqual(C.shinyFrom(pkt).map(x=>x.name),['Totodile']);
});
