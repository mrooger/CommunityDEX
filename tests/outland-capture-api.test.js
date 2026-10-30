'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../core.js');
const L=require('../capture-log.js');
const M=require('../session.js');

const outland=[
  ['Ancient Alakazam',65],['Furious Ampharos',181],['Wardog Arcanine',59],['Brave Blastoise',9],
  ['Brave Charizard',6],['Moon Clefable',36],['Evil Cloyster',91],['Dark Crobat',169],
  ['Freezing Dewgong',87],['Roll Donphan',232],['Ancient Dragonair',148],['Magnetic Electabuzz',125],
  ['Tribal Feraligatr',160],['Trickmaster Gengar',94],['Enigmatic Girafarig',203],['Hard Golem',76],
  ['War Granbull',210],['War Gyarados',130],['War Heracross',214],['Boxer Hitmonchan',107],
  ['Taekwondo Hitmonlee',106],['Capoeira Hitmontop',237],['Hypno',97],['Psy Jynx',124],
  ['Lava Magmar',126],['Furious Mantine',226],['Bone Marowak',105],['Ancient Meganium',154],
  ['Milch-Miltank',241],['Banshee Misdreavus',200],['Furious Murkrow',198],['Brave Nidoking',34],
  ['Brave Nidoqueen',31],['Brave Noctowl',164],['Parasect',47],['Aviator Pidgeot',18],
  ['Heavy Piloswine',221],['War Pinsir',127],['Ancient Pupitar',247],['Charged Raichu',26],
  ['Brute Rhydon',112],['Furious Sandslash',28],['Furious Scyther',123],['Metal Skarmory',227],
  ['Iron Steelix',208],['Enraged Typhlosion',157],['Brave Venusaur',3],['Singer Wigglytuff',40],
  ['Tribal Xatu',178],['Ancient Dragonite',149],['Ancient Kingdra',230],['Undefeated Machamp',68],
  ['Octopus Octillery',224],['Furious Scizor',212],['Brute Snorlax',143],['Elder Tangela',114],
  ['Elder Tentacruel',73],['Brute Tyranitar',248],['Brute Ursaring',217],['Elder Muk',89]
];

test('todos os 60 Pokémon de Outland usam o sprite base mesmo com speciesId especial',()=>{
  assert.equal(outland.length,60);
  for(const [name,id] of outland){
    assert.equal(C.speciesSprite(name,false,null,40000),`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,name);
    assert.equal(C.baseSprite(name,true),`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${id}.png`,name);
  }
});

test('os Pokémon comuns continuam usando sprite fornecido pelo jogo',()=>{
  assert.equal(C.speciesSprite('Totodile',false,'https://poke.idleworld.online/custom/toto.png'),'https://poke.idleworld.online/custom/toto.png');
  assert.equal(C.speciesSprite('Wardog Arcanine',false,'https://poke.idleworld.online/missing.png'),'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/59.png');
});

test('capturas sucessivas da mesma espécie recebem qualidades/IV diferentes pelo log ordenado',()=>{
  const t=Date.now();
  const captures=[
    {name:'Totodile',success:true,t:t-1500,rarity:null,ivTotal:null},
    {name:'Totodile',success:true,t:t-21000,rarity:null,ivTotal:null},
    {name:'Totodile',success:true,t:t-80000,rarity:null,ivTotal:null}
  ];
  const rows=[
    {name:'Totodile',quality:1.8,ivTotal:150},
    {name:'Totodile',quality:1.53,ivTotal:145},
    {name:'Totodile',quality:1.28,ivTotal:135}
  ];
  const matches=L.reconcileApiRows(rows,captures,t);
  assert.equal(matches.length,3);
  for(let i=0;i<3;i++){
    assert.equal(matches.find(x=>x.meta.ivTotal===rows[i].ivTotal)?.capture,captures[i]);
    assert.equal(M.rarity(null,matches.find(x=>x.meta.ivTotal===rows[i].ivTotal).meta.quality),['Lendário','Épico','Incomum'][i]);
  }
});

test('pendente não substitui captura, confirmação com horário corrige IV',()=>{
  const t=Date.now(), capture={name:'Arcanine',success:true,t:t-70000,ivTotal:null};
  assert.equal(L.reconcileApiRows([{name:'Arcanine',quality:null,ivTotal:null}], [capture],t).length,0);
  const enriched=L.reconcileApiRows([{name:'Arcanine',quality:1.755,ivTotal:162,createdAt:new Date(t-70000).toISOString()}],[capture],t);
  assert.equal(enriched.length,1);
  assert.equal(enriched[0].capture,capture);
  assert.equal(enriched[0].meta.ivTotal,162);
});

test('não associa atributos de outra espécie ou registro com horário incompatível',()=>{
  const t=Date.now(), capture={name:'Scizor',success:true,t:t-3000};
  assert.equal(L.reconcileApiRows([{name:'Arcanine',quality:1.7,ivTotal:144}],[capture],t).length,0);
  assert.equal(L.reconcileApiRows([{name:'Scizor',quality:1.7,ivTotal:144,createdAt:new Date(t-3600000).toISOString()}],[capture],t).length,0);
});

test('ponte consulta o endpoint autenticado e nunca encaminha token ou dados pessoais',async()=>{
  const emitted=[],listeners=[],requests=[];
  class Socket{addEventListener(){}}
  const page={WebSocket:Socket,postMessage:m=>emitted.push(m),addEventListener:(type,fn)=>listeners.push({type,fn})};
  const secret='private-token-should-not-appear';
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../main-bridge.js'),'utf8'),{
    window:page,location:{origin:'https://poke.idleworld.online'},sessionStorage:{getItem:key=>key==='pokeweb:tokens'?JSON.stringify({accessToken:secret}):null},
    fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({rows:[{name:'Arcanine',quality:1.55,ivTotal:151,email:'private@example.com',secret:'private'}]})};},
    WeakSet,Map,Proxy,Reflect,JSON,Date,TextDecoder,ArrayBuffer,Object,String,Number,console,setTimeout
  });
  const onRequest=listeners.find(x=>x.type==='message')?.fn;
  assert.ok(onRequest);
  onRequest({source:page,origin:'https://poke.idleworld.online',data:{channel:'__COMMUNITY_DEX_EVENTS_V1__',type:'capture-log-request'}});
  for(let i=0;i<15&&!emitted.some(x=>x.type==='capture-log-data');i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,'/api/game/capture-log?filter=all');
  assert.equal(requests[0].options.method,'GET');
  assert.equal(requests[0].options.headers.Authorization,`Bearer ${secret}`);
  const result=emitted.find(x=>x.type==='capture-log-data');
  assert.equal(result.payload.rows[0].ivTotal,151);
  assert.equal(result.payload.rows[0].email,undefined);
  assert.equal(result.payload.rows[0].secret,undefined);
  assert.equal(JSON.stringify(emitted).includes(secret),false);
});

test('Log atrasado da mesma espécie não aplica dados antigos à última captura',()=>{
  const t=Date.now();
  const captures=[{name:'Totodile',success:true,t:t-2500},{name:'Totodile',success:true,t:t-48000}];
  const rows=[{name:'Totodile',quality:1.2,ivTotal:115,createdAt:new Date(t-48000).toISOString()}];
  const result=L.reconcileApiRows(rows,captures,t);
  assert.equal(result.length,1);
  assert.equal(result[0].capture,captures[1]);
});
