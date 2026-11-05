'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../core.js');
const MK=require('../market.js');
const manifest=require('../manifest.json');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../app.css'),'utf8');
function cell(text,label=''){
  return {innerText:text,querySelector(sel){return label?{innerText:label}:null;}};
}
function details(title='Gengar Lv.100',statTexts=['HP 580','Atk 385','Def 340','SpA 520','SpD 420','Spd 460']){
  const cells=statTexts.map(s=>cell(s));
  const data={innerText:`${title}\nRaridade Épica ×1,55\nIV 144/192\nPoder 12.340`,querySelector(sel){
    if(sel==='.mkt2-details-name')return {innerText:title};
    return null;
  },querySelectorAll(sel){
    if(sel==='.mkt2-stats .mkt2-statcell')return cells;
    if(sel.includes('mkt2-card-badges'))return [{innerText:'Fantasma'},{innerText:'Venenoso'}];
    return [];
  }};
  return data;
}
test('v1.5.0 includes market reader in correct content script order',()=>{
  assert.equal(manifest.version,'1.5.0');
  const files=manifest.content_scripts.find(c=>c.world==='ISOLATED').js;
  assert(files.indexOf('market.js')>files.indexOf('core.js'));
  assert(files.indexOf('market.js')<files.indexOf('app.js'));
});
test('reads the market side panel with Pokémon name, stats, quality, types, IV and power',()=>{
  const p=MK.parseDetails(details(),{innerText:'Gengar IV 144/192'});
  assert(p);assert.equal(p.source,'market');
  assert.equal(p.name,'Gengar');assert.equal(p.level,100);
  assert.equal(p.quality,1.55);assert.equal(p.ivTotal,144);
  assert.equal(p.ivMax,192);assert.equal(p.power,12340);
  assert.deepEqual(p.stats,{hp:580,atk:385,def:340,spa:520,spd:420,spe:460});
  assert.deepEqual(p.types,['ghost','poison']);
});
test('does not mistake an item detail panel for a Pokémon',()=>{
  assert.equal(MK.parseDetails(details('Ultra Ball'),null),null);
  assert.equal(MK.parseDetails(details('Gengar Lv.100',['HP 500']),null),null);
});
test('simple form builds Pokémon object compatible with existing IV calculator',()=>{
  const result=C.manualPokemon({name:'Arcanine',level:'100',quality:'1,80',type1:'fire',
    hp:'400',atk:'300',def:'200',spa:'240',spd:'230',spe:'275',ivTotal:'140',power:'12500'});
  assert(result);assert.equal(result.name,'Arcanine');assert.equal(result.level,100);
  assert.equal(result.quality,1.8);assert.deepEqual(result.types,['fire']);
  assert.equal(result.stats.spa,240);assert.equal(result.ivTotal,140);assert.equal(result.power,12500);
  assert.match(C.formatPokemonSheet(result),/Arcanine/);
});
test('simple form prevents invalid data and accepts missing optional fields',()=>{
  const fields={name:'Totodile',level:'50',quality:'1.2',hp:'200',atk:'150',def:'110',spa:'130'};
  assert(C.manualPokemon(fields));
  assert.equal(C.manualPokemon({...fields,name:' '}),null);
  assert.equal(C.manualPokemon({...fields,quality:''}),null);
  assert.equal(C.manualPokemon({...fields,ivTotal:'193'}),null);
  assert.equal(C.manualPokemon({...fields,hp:'',atk:''}),null);
});
test('UI provides collapsed simplified form after existing manual entry and market triggers',()=>{
  assert.match(app,/pokemonSimple:false/);
  assert(app.indexOf("expandable('pokemonManual'")<app.indexOf("expandable('pokemonSimple'"));
  for(const field of ['name','level','quality','hp','atk','def','spa','spd','spe','ivTotal','power']){
    assert(app.includes(`field('${field}'`)||app.includes(`['${field}','`) ,`Missing ${field}`);
  }
  assert.match(app,/data-action="parse-simple"/);
  assert.match(app,/\.mkt2-details/);
  assert.match(app,/scheduleMarketScan/);
  assert.match(css,/\.sd-simple-form/);
});

test('market: accented physical and special Defense labels never overlap',()=>{
  const p=MK.parseDetails(details('Gengar Lv.100',[
    'HP 580','Atk 385','Def 340','Atq. Esp. 520','Def. Esp. 420','Velocidade 460'
  ]));
  assert(p);
  assert.deepEqual(p.stats,{hp:580,atk:385,def:340,spa:520,spd:420,spe:460});
});

test('market: case-sensitive SpD means special defense; Spd means speed',()=>{
  const p=MK.parseDetails(details('Gengar Lv.100',[
    'HP 580','Atk 385','Def 340','SpA 520','SpD 420','Spd 460'
  ]));
  assert(p);
  assert.equal(p.stats.def,340);
  assert.equal(p.stats.spd,420);
  assert.equal(p.stats.spe,460);
});

test('market: labeled stats are mapped correctly even if the grid changes order',()=>{
  const p=MK.parseDetails(details('Gengar Lv.100',[
    'Sp. Def. 420','Def. 340','Speed 460','HP 580','Sp. Atk. 520','Attack 385'
  ]));
  assert(p);
  assert.deepEqual(p.stats,{hp:580,atk:385,def:340,spa:520,spd:420,spe:460});
});

test('market: separate label elements and pt-BR number separators are supported',()=>{
  const labels=['HP','Ataque','Defesa','Ataque Especial','Defesa Especial','Velocidade'];
  const numbers=['2.500','1.234','3.450','2.620','4.710','890'];
  const data=details();
  const old=data.querySelectorAll.bind(data);
  data.querySelectorAll=sel=>sel==='.mkt2-stats .mkt2-statcell'
    ?numbers.map((n,i)=>({innerText:n,querySelector(q){
        if(q.includes('.mkt2-statvalue'))return {innerText:n};
        if(q.includes('.mkt2-statlabel'))return {innerText:labels[i]};
        return null;
      }}))
    :old(sel);
  const p=MK.parseDetails(data);
  assert(p);
  assert.deepEqual(p.stats,{hp:2500,atk:1234,def:3450,spa:2620,spd:4710,spe:890});
});

test('market: duplicates with conflicting values are rejected instead of mislabeling',()=>{
  const p=MK.parseDetails(details('Gengar Lv.100',[
    'HP 580','Atk 385','Def 340','Def. Esp. 420','Def 999','Speed 460'
  ]));
  assert.equal(p,null);
});

test('market: positional fallback remains available for six genuinely unlabeled cells',()=>{
  const p=MK.parseDetails(details('Gengar Lv.100',['580','385','340','520','420','460']));
  assert(p);
  assert.deepEqual(p.stats,{hp:580,atk:385,def:340,spa:520,spd:420,spe:460});
});

test('market: ambiguous partially labeled rows do not invent missing stats',()=>{
  const p=MK.parseDetails(details('Gengar Lv.100',[
    'HP 580','Atk 385','Def 340','? 520','? 420','Speed 460'
  ]));
  assert(p);
  assert.equal(p.stats.spa,null);
  assert.equal(p.stats.spd,null);
  assert.equal(p.stats.def,340);
});
