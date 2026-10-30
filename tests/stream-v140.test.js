'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const C=require('../core.js');
const L=require('../capture-log.js');
const M=require('../session.js');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app.css'),'utf8');

test('Stream Geral is optional, hidden by default and reorderable with all tabs',()=>{
  assert.match(app,/\['stream','Stream Geral','📹'\]/);
  assert.match(app,/stream:false/);
  assert.match(app,/tabOrder:\s*OPTIONAL_TABS/);
  assert.match(app,/stream,settings/);
  assert.match(app,/\['streamMetrics','Indicadores'\]/);
  assert.match(app,/\['streamRecent','Últimas capturas'\]/);
});
test('Stream Geral presents six readable metrics in three rows and shared capture list',()=>{
  const section=app.slice(app.indexOf('  function stream(){'),app.indexOf('  function shiny(){'));
  assert.doesNotMatch(section,/card\('Abates na sessão'/);
  assert.match(section,/card\('Abates \/ hora'/);
  assert.match(section,/card\('Abates totais'/);
  assert.match(section,/card\('Capturas'/);
  assert.match(section,/card\('Shinies encontrados'/);
  assert.doesNotMatch(section,/bestCaptureCard\(\)/);
  assert.doesNotMatch(section,/card\('Shinies \(24h\)'/);
  assert.match(section,/card\('Ritmo da Hunt'/);
  assert.match(section,/card\('XP da sessão'/);
  assert.match(section,/captureHistory\(true\)/);
  assert.equal((section.match(/card\('/g)||[]).length,6);
  assert.match(css,/\.sd-stream-metrics\{display:grid;grid-template-columns:repeat\(2/);
  assert.match(css,/\.sd-stream-metrics \.sd-metric strong\{[^}]*font-size:27px/);
});
test('Captured Pokémon sprite uses game image first, with catalog sprite or species fallback',()=>{
  const own='https://poke.idleworld.online/game/sprites/totodile.png';
  assert.equal(C.speciesSprite('Totodile',false,own),own);
  assert.match(C.speciesSprite('Totodile',true),/shiny\/158\.png$/);
  assert.equal(C.safeSprite('javascript:alert(1)'),null);
  assert.equal(C.safeSprite('data:image/png;base64,AA'),null);
  C.registerSpeciesCatalog([{name:'Growlithe',id:58,spriteUrl:'https://poke.idleworld.online/game/sprites/growlithe.webp'}]);
  assert.equal(C.speciesSprite('Growlithe'), 'https://poke.idleworld.online/game/sprites/growlithe.webp');
});
test('Capture log image is associated with correct capture and preserved through session model',()=>{
  const image='https://poke.idleworld.online/img/totodile.png';
  const row={innerText:'Totodile\nLendária · ×1,8 · IV 140/192',dataset:{},querySelector(selector){
    if(selector.includes('clog-meta'))return {innerText:'Lendária · ×1,8 · IV 140/192'};
    if(selector.includes('clog-name'))return {textContent:'Totodile'};
    return null;
  },querySelectorAll(selector){return selector==='.clog-sprite img'?[{currentSrc:image,getAttribute:()=>image}]:[];}};
  const meta=L.parseRow(row);assert.equal(meta.spriteUrl,image);
  const ses=M.fresh(Date.now()-1000);
  M.addCapture(ses,{name:'Totodile',ball:'Ultra Ball',success:true,t:Date.now()-100});
  const cap=ses.recentCaptures[0];
  Object.assign(cap,meta);
  M.enrichCapture(ses,cap);
  assert.equal(ses.recentCaptures[0].spriteUrl,image);
  assert.equal(ses.bestCapture.spriteUrl,image);
});
test('Stream filters start minimized and capture UI updates without discarding new quick successes',()=>{
  assert.match(app,/streamFiltersExpanded:false/);
  assert.match(app,/toggle-stream-filters/);
  assert.match(app,/show-more-stream-catches/);
  assert.match(app,/Math\.abs\(prev\.t-c\.t\)<230/);
  assert.match(app,/setTimeout\(scheduleCaptureLog,450\)/);
  const ses=M.fresh(Date.now()-2000),t=Date.now();
  M.addCapture(ses,{name:'Totodile',success:true,t:t-800});
  M.addCapture(ses,{name:'Totodile',success:true,t:t});
  assert.equal(ses.captures,2);
});
test('Shiny configuration content has separate padding from the section divider',()=>{
  assert.match(css,/\[data-section="shinyDetector"\]\) \.sd-collapse-content\{padding-top:13px\}/);
});
