'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const L=require('../capture-log.js');

function row(name,meta,when=''){
  return {
    innerText:`${name}\n${meta}${when?'\n'+when:''}`,
    dataset:{},
    querySelector(selector){
      if(selector.includes('clog-meta'))return {innerText:meta};
      if(selector.includes('clog-name'))return {textContent:name};
      if(selector.includes('clog-when'))return when?{innerText:when}:null;
      return null;
    },
    querySelectorAll(){return [];}
  };
}

test('capturas repetidas da mesma espécie são vinculadas na ordem do log',()=>{
  const now=Date.now();
  const captures=[
    {name:'Totodile',success:true,t:now-5000},
    {name:'Totodile',success:true,t:now-45000},
    {name:'Totodile',success:true,t:now-95000}
  ];
  const rows=[row('Totodile','Lendária ×1,800 IV 140/192'),row('Totodile','Rara ×1,350 IV 92/192'),row('Totodile','Comum ×1,050 IV 44/192')];
  const matches=L.reconcileRows(rows,captures,now);
  assert.equal(matches.length,3);
  for(let i=0;i<3;i++)assert.equal(matches.find(x=>x.row===rows[i])?.capture,captures[i]);
  assert.equal(matches[0].meta.ivTotal,140);
});

test('log aberto mais tarde associa captura pela hora e minuto, sem exigir segundos iguais',()=>{
  const t=new Date();t.setHours(14,23,46,0);
  const capture={name:'Aggron',success:true,t:t.getTime()};
  const r=row('Aggron','Lendária ×1,78 IV 160/192','14:23');
  const found=L.reconcileRows([r],[capture],t.getTime()+3*3600000);
  assert.equal(found.length,1);
  assert.equal(found[0].capture,capture);
});

test('horário e identidade incompatíveis não atribuem IV de outro Pokémon',()=>{
  const t=new Date();t.setHours(14,23,46,0);
  const capture={name:'Aggron',success:true,t:t.getTime()};
  assert.equal(L.reconcileRows([row('Swellow','Rara IV 159/192','14:23')],[capture],t.getTime()+30*60000).length,0);
  assert.equal(L.reconcileRows([row('Aggron','Rara IV 159/192','09:11')],[capture],t.getTime()+30*60000).length,0);
});

test('linha enriquecida não depende de o atributo vir na .clog-meta',()=>{
  const r=row('Swellow','', '12:25');
  r.innerText='Swellow\nLendária x1.800 IV: 152/192\n12:25';
  const data=L.parseRow(r);
  assert.equal(data.ivTotal,152);
  assert.equal(data.quality,1.8);
  assert.equal(data.rarity,'Lendário');
  assert.equal(data.clock,'12:25:00');
  assert.equal(data.clockPrecision,'minute');
});

test('captura antiga acima de 10 minutos pode ser enriquecida até 24 horas',()=>{
  const at=Date.now(),c={name:'Totodile',success:true,t:at-12*3600000};
  assert.equal(L.chooseCapture({name:'Totodile'},[c],at),c);
  assert.equal(L.chooseCapture({name:'Totodile'},[{...c,t:at-25*3600000}],at),null);
});
