const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');

test('converts recorded shiny species identifiers to canonical names',()=>{
 const examples={277:'Swellow',306:'Aggron',158:'Totodile',157:'Typhlosion',228:'Houndour'};
 for(const [id,name] of Object.entries(examples)){
  const [event]=C.shinyFrom({type:'field',mobs:[{shiny:true,speciesId:Number(id),row:1,col:2,hp:10}]});
  assert.equal(event.name,name);assert.equal(event.speciesId,Number(id));
 }
});
test('two descriptions in the same WebSocket packet are one encounter',()=>{
 const packet={type:'field',mobs:[{shiny:true,speciesId:277,row:11,col:22,hp:14,id:3},{shiny:true,speciesName:'Swellow',row:11,col:22,hp:14,id:3}]};
 assert.equal(C.shinyFrom(packet).length,1);
 assert.equal(C.shinyFrom(packet)[0].name,'Swellow');
});
test('historic numeric and named pair merges while separate encounters remain',()=>{
 const t=Date.now();
 const input=[{name:'277',position:'1:2',t:t},{name:'Swellow',position:'1:2',t:t-900},{name:'306',position:'4:5',t:t-1000},{name:'Aggron',position:'4:5',t:t-1200},{name:'Swellow',position:'1:2',t:t-120000}];
 const clean=C.normalizeShinyHistory(input);
 assert.equal(clean.length,3);
 assert.equal(clean[0].name,'Swellow');assert.equal(clean[1].name,'Aggron');
});
test('catalog extends species names without replacing known fallback with number',()=>{
 C.registerSpeciesCatalog({creatures:[{pokeId:313,name:'Volbeat'}]});
 const [event]=C.shinyFrom({type:'field',mobs:[{shiny:true,species:313,row:1,col:1,hp:10}]});
 assert.equal(event.name,'Volbeat');
});
