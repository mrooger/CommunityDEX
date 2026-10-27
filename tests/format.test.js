const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../core.js');

test('scanned Pokémon sheet copies every attribute, quality, types and IVs', () => {
  const scanned = {
    name:'Arcanine',level:100,quality:1.8,ivTotal:137,ivMax:192,
    types:['fire'],power:10099,
    stats:{hp:1009,atk:847,def:621,spa:788,spd:633,spe:710}
  };
  const sheet=C.formatPokemonSheet(scanned);
  assert.match(sheet,/Arcanine/);
  assert.match(sheet,/IV: 137\/192/);
  assert.match(sheet,/Tipos: Fogo/);
  assert.match(sheet,/SpD: 633/);
  assert.match(sheet,/Spd: 710/);
  const roundTrip=C.parseTooltip(sheet);
  assert.equal(roundTrip.name,'Arcanine');
  assert.equal(roundTrip.level,100);
  assert.equal(roundTrip.quality,1.8);
  assert.deepEqual(roundTrip.stats,scanned.stats);
  assert.deepEqual(roundTrip.types,['fire']);
  assert.equal(roundTrip.power,10099);
});

test('manual template contains recognizable placeholders for every stat', () => {
  const template=C.formatPokemonSheet(null);
  for (const key of ['[nível]','[qualidade]','HP: [valor]','Atk: [valor]','Def: [valor]','SpA: [valor]','SpD: [valor]','Spd: [valor]']) {
    assert.ok(template.includes(key),`Missing ${key}`);
  }
  assert.equal(C.parseTooltip(template),null);
});
