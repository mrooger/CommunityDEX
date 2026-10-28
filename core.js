/* Community Dex • Data normalization and local calculators */
(function (scope) {
  "use strict";
  const STAT_NAMES = { hp:"HP", atk:"Ataque", def:"Defesa", spa:"Atq. especial", spd:"Def. especial", spe:"Velocidade" };
  const STAT_EXPONENT = { hp:0.95, atk:0.8, def:0.8, spa:0.8, spd:0.8, spe:0.95 };
  const ATTACK = {
    normal:{rock:.5,ghost:0,steel:.5},fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
    water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
    grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
    ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
    fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
    poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
    ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
    flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
    psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
    bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
    rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
    ghost:{normal:0,psychic:2,ghost:2,dark:.5},
    dragon:{dragon:2,steel:.5,fairy:0},
    dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
    steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
    fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
  };
  const TYPE_PT={normal:"Normal",fire:"Fogo",water:"Água",electric:"Elétrico",grass:"Planta",ice:"Gelo",fighting:"Lutador",poison:"Venenoso",ground:"Terrestre",flying:"Voador",psychic:"Psíquico",bug:"Inseto",rock:"Pedra",ghost:"Fantasma",dragon:"Dragão",dark:"Sombrio",steel:"Aço",fairy:"Fada"};
  const TYPE_ALIASES={fogo:"fire",agua:"water",água:"water",eletrico:"electric",elétrico:"electric",planta:"grass",gelo:"ice",lutador:"fighting",luta:"fighting",venenoso:"poison",veneno:"poison",terrestre:"ground",terra:"ground",voador:"flying",psiquico:"psychic",psíquico:"psychic",inseto:"bug",pedra:"rock",fantasma:"ghost",dragao:"dragon",dragão:"dragon",sombrio:"dark",noturno:"dark",aco:"steel",aço:"steel",fada:"fairy"};
    function num(value){
    if (typeof value === 'number') return Number.isFinite(value)?value:null;
    const str=String(value??'').trim().replace(/\s/g,'');
    if (!str) return null;
    // 1.234.567 -> 1234567, 1,80 -> 1.8, 1,234.56 -> 1234.56
    let s=str;
    if (/^[-+]?\d{1,3}(?:[.,]\d{3})+$/.test(s)) s=s.replace(/[.,]/g,'');
    else if (s.includes(',') && s.includes('.')) {
      s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
    } else s=s.replace(',','.');
    const v=Number(s); return Number.isFinite(v)?v:null;
  }
  function positive(value){const n=num(value);return n!==null&&n>=0?n:null;}
  function text(v,max=100){return String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);}
  function escape(v){return text(v,20000).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function format(v,dec=0){if(v===null||v===undefined||!Number.isFinite(Number(v)))return '—';return Number(v).toLocaleString('pt-BR',{maximumFractionDigits:dec});}
  function short(v){const n=Number(v);if(!Number.isFinite(n))return '—';if(Math.abs(n)>=1e9)return format(n/1e9,1)+' bi';if(Math.abs(n)>=1e6)return format(n/1e6,1)+' mi';if(Math.abs(n)>=1e3)return format(n/1e3,1)+' mil';return format(n);}
  function typeCode(s){const norm=text(s,35).toLowerCase();return ATTACK[norm]?norm:(TYPE_ALIASES[norm]||null);}
  function typeMatrix(types){const defend=(Array.isArray(types)?types:[]).map(typeCode).filter(Boolean);if(!defend.length)return {weak:[],resist:[],immune:[]};const all=Object.keys(ATTACK).map(attack=>({type:attack,mult:defend.reduce((v,t)=>v*(ATTACK[attack][t]??1),1)}));return {weak:all.filter(x=>x.mult>1).sort((a,b)=>b.mult-a.mult),resist:all.filter(x=>x.mult>0&&x.mult<1).sort((a,b)=>a.mult-b.mult),immune:all.filter(x=>x.mult===0)};}
  function labels(regex,s){const m=String(s).match(regex);return m?num(m[1]):null;}
  // Tooltips in the game may join adjacent elements without spaces:
  // "...IV122/192HP1017Atk847SpD239Spd331".
  // A leading \b would reject HP and many other attributes in that layout.
  function gameNumber(source,names,{caseSensitive=false}={}){
    const alternatives=names.join('|');
    const re=new RegExp('(?:^|[^a-zA-Z])(?:'+alternatives+')\\s*[:\\-]?\\s*([0-9][0-9.,]*)',caseSensitive?'g':'gi');
    let match;
    while((match=re.exec(source))){
      const parsed=num(match[1]);
      if(parsed!==null)return parsed;
    }
    return null;
  }
  function parseTooltip(raw,explicitName='',explicitTypes=''){
    const s=String(raw??'').slice(0,7000).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,' ').replace(/\u00a0/g,' ');
    if(s.length<10)return null;
    // The character before Lv/Nv can be a letter when the DOM joins type + level.
    const level=labels(/(?:lv\.?|lvl|nv\.?|level|n[ií]vel)\s*[:\-]?\s*(\d+)/i,s);
    const quality=labels(/(?:[×x*])\s*(\d+(?:[.,]\d+)?)/i,s);
    const sumIVMatch=s.match(/IVs?\s*[:\-]?\s*(\d{1,3})\s*\/\s*(\d{2,3})/i);
    // Keep the game's distinct "SpD" (special defense) and "Spd" (speed) separate.
    // First pass is case-sensitive; otherwise an insensitive /spd/i merges both.
    const rawStat={
      hp:gameNumber(s,['max\\s*hp','HP','PS','vida','sa[uú]de']),
      atk:gameNumber(s,['Atk','Attack','Ataque']),
      def:gameNumber(s,['Def','Defense','Defesa']),
      spa:gameNumber(s,['SpA','SpAtk','Sp\\.?\\s*Atk','SpAtck','AtkEsp','special\\s*attack','ataque\\s*especial']),
      spd:gameNumber(s,['SpD','SpDef','Sp\\.?\\s*Def','DefEsp'],{caseSensitive:true}),
      spe:gameNumber(s,['Spd','Spe','Speed','Vel','Velocidade'],{caseSensitive:true})
    };
    if(rawStat.spd===null)rawStat.spd=gameNumber(s,['SpDef','Sp\\.?\\s*Def','DefEsp','special\\s*defense','defesa\\s*especial']);
    if(rawStat.spe===null)rawStat.spe=gameNumber(s,['Spe','Speed','Vel','Velocidade']);
    const count=Object.values(rawStat).filter(v=>v!==null).length;
    if(level===null||count<4)return null;
    const fallbackName=s.split(/[\n\r]/).map(x=>x.trim()).find(x=>x&&!/^(lv|level|nv|nivel|nível|quality|raridade|hp|iv\b)/i.test(x))||'Pokémon';
    const name=text(explicitName||fallbackName,70);
    const listedTypes=s.match(/(?:tipos?|types?)\s*[:\-]\s*([^\n\r]+)/i)?.[1]||'';
    const declaredTypes=String(explicitTypes||listedTypes).split(/[\s,\/|•·]+/).map(typeCode).filter(Boolean);
    const types=[...new Set(declaredTypes)];
    return {name,level,quality:quality??1,ivTotal:sumIVMatch?num(sumIVMatch[1]):null,ivMax:sumIVMatch?num(sumIVMatch[2]):null,stats:rawStat,types,power:labels(/(?:poder|power)\s*[:\-]?\s*([\d.,]+)/i,s),timestamp:Date.now()};
  }
  const MANUAL_TEMPLATE = [
    'Nome do Pokémon',
    'Lv: [nível] · Quality: ×[qualidade] · IV: [total]/192',
    'Tipos: [tipo 1], [tipo 2]',
    'HP: [valor]', 'Atk: [valor]', 'Def: [valor]',
    'SpA: [valor]', 'SpD: [valor]', 'Spd: [valor]'
  ].join('\n');
  function formatPokemonSheet(pokemon){
    if(!pokemon)return MANUAL_TEMPLATE;
    const p=pokemon;
    const level=Number.isFinite(Number(p.level))?String(p.level):'[nível]';
    const q=Number.isFinite(Number(p.quality))?Number(p.quality).toFixed(2):'[qualidade]';
    const iv=p.ivTotal!==null&&p.ivTotal!==undefined?` · IV: ${p.ivTotal}/${p.ivMax||192}`:'';
    const types=(p.types||[]).map(t=>TYPE_PT[typeCode(t)]||text(t,25)).filter(Boolean);
    const rows=[text(p.name,70)||'Pokémon',`Lv: ${level} · Quality: ×${q}${iv}`];
    if(types.length)rows.push('Tipos: '+types.join(', '));
    for(const [key,label] of [['hp','HP'],['atk','Atk'],['def','Def'],['spa','SpA'],['spd','SpD'],['spe','Spd']]){
      const value=p.stats?.[key];
      rows.push(`${label}: ${value===null||value===undefined?'[valor]':String(value)}`);
    }
    if(p.power!==null&&p.power!==undefined)rows.push('Poder: '+String(p.power));
    return rows.join('\n');
  }
  function estimateIV(pokemon,base,maxIV=32){
    if(!pokemon||!base||!Number.isFinite(pokemon.level)||pokemon.level<1)return null;
    const q=Math.max(.1,Number(pokemon.quality)||1), cap=maxIV===31?31:32;
    const ivs={};let total=0;let count=0;let error=0;
    for(const key of Object.keys(STAT_NAMES)){
      const stat=Number(pokemon.stats?.[key]);const b=Number(base[key]);
      if(!Number.isFinite(stat)||!Number.isFinite(b)||pokemon.stats?.[key]===null||base[key]===null){ivs[key]=null;continue;}
      const multiplier=(pokemon.level/100)*Math.pow(q,STAT_EXPONENT[key]);
      let bestIV=0,minDiff=Infinity;
      for(let i=0;i<=cap;i++){const projected=Math.round((b+2*i)*multiplier);const diff=Math.abs(projected-stat);if(diff<minDiff){bestIV=i;minDiff=diff;}}
      ivs[key]=bestIV;total+=bestIV;count++;error+=minDiff;
    }
    if(count<4)return null;
    return {ivs,total,potential:Math.round((total/(cap*count))*1000)/10,count,max:cap*count,confidence:error===0?'alta':error/count<2?'moderada':'baixa',avgError:error/count};
  }
  function normalizeName(name){return text(name,70).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/♀/g,'-f').replace(/♂/g,'-m').replace(/[^a-z0-9-\s]/g,'').trim().replace(/\s+/g,'-');}
  function xpForLevel(L){const level=Math.max(1,Math.min(10000,Math.floor(Number(L)||1)));return Math.round((50/3)*(level**3-6*level**2+17*level-12));}
  function huntRates(kills,now=Date.now()){
    const entries=(kills||[]).filter(e=>e&&now-e.t<60*60*1000&&e.t<=now).sort((a,b)=>a.t-b.t).slice(-2000);
    if(entries.length<2)return {xpHour:null,killsHour:null,activeMs:0};
    let activeMs=0;for(let i=1;i<entries.length;i++)activeMs+=Math.min(90000,Math.max(0,entries[i].t-entries[i-1].t));
    const period=Math.max(1000,activeMs);
    return {xpHour:Math.round(entries.slice(1).reduce((sum,k)=>sum+(Number(k.xp)||0),0)*3600000/period),killsHour:Math.round((entries.length-1)*3600000/period),activeMs};
  }
  function packetNodes(input,max=100){const queue=[input],visited=new WeakSet(),out=[];while(queue.length&&out.length<max){const item=queue.shift();if(!item||typeof item!=='object'||visited.has(item))continue;visited.add(item);out.push(item);for(const k of ['payload','data','detail','result','event','mobs','entities','monsters','pokemons','list','events']){const v=item[k];if(Array.isArray(v)) queue.push(...v.slice(0,120));else if(v&&typeof v==='object')queue.push(v);}if(Array.isArray(item))queue.push(...item.slice(0,120));}return out;}
  const speciesById=new Map([[277,'Swellow'],[306,'Aggron'],[158,'Totodile'],[157,'Typhlosion'],[228,'Houndour']]);
  const idBySpecies=new Map([...speciesById].map(([id,name])=>[name.toLowerCase(),id]));
  function registerSpeciesCatalog(creatures){
    const list=Array.isArray(creatures)?creatures:Array.isArray(creatures?.creatures)?creatures.creatures:[];
    for(const entry of list){
      if(!entry||typeof entry!=='object')continue;
      const id=Number(entry.pokeId??entry.speciesId??entry.pokemonId??entry.dexId??entry.id);
      const name=text(entry.name||entry.speciesName||entry.pokemonName||entry.displayName||'',70).trim();
      if(Number.isInteger(id)&&id>0&&id<50000&&name&&!/^\d+$/.test(name)){
        speciesById.set(id,name);idBySpecies.set(name.toLowerCase(),id);
      }
    }
    return speciesById.size;
  }
  function speciesIdentity(item){
    const possible=[item.speciesId,item.pokeId,item.pokemonId,item.species,item.speciesName,item.pokemonName,item.name];
    const rawName=possible.find(x=>typeof x==='string'&&!/^\d+$/.test(x.trim())&&x.trim());
    const idRaw=possible.find(x=>x!==null&&x!==undefined&&/^\d+$/.test(String(x).trim()));
    const id=idRaw===undefined?null:Number(idRaw);
    const label=text(rawName||speciesById.get(id)||(id?'Pokémon #'+id:'Shiny'),70);
    const knownId=id||idBySpecies.get(label.toLowerCase())||null;
    return {name:speciesById.get(knownId)||label,speciesId:knownId};
  }
  function normalizedShinyName(value){
    const name=text(value||'Shiny',70).trim();
    if(/^\d+$/.test(name))return speciesById.get(Number(name))||'Pokémon #'+name;
    const unidentified=name.match(/^Pokémon #([0-9]+)$/i);
    if(unidentified)return speciesById.get(Number(unidentified[1]))||name;
    return name;
  }
  // An encounter is only generated by a map/field sighting. Character,
  // inventory, capture and combat events may also contain shiny:true.
  function mapSightingsPacket(packet){
    const type=text(packet?.type||packet?.event||packet?.kind,65).toLowerCase();
    if(/^(?:field-kill|poke-xp|catch|capture|pokes|pokemon|inventory|party|character|market|shop|battle|combat|attack|analyzer)/.test(type))return false;
    if(/^(?:field|map|spawn)(?:[-_](?:state|update|sync|mobs|monsters|entities|snapshot|refresh|enter|spawn|batch))?$/.test(type))return true;
    // Some protocol envelopes omit type, but carry an explicit map collection.
    const containers=[packet,packet?.data,packet?.payload,packet?.detail].filter(x=>x&&typeof x==='object');
    return containers.some(x=>['mobs','monsters','entities'].some(k=>Array.isArray(x[k])));
  }
  // Walk only map envelopes and mob collections; party/list data may also
  // contain shiny:true but does not represent a wild encounter.
  function mapNodes(input,max=320){
    const queue=[input],visited=new WeakSet(),nodes=[];
    while(queue.length&&nodes.length<max){
      const item=queue.shift();
      if(!item||typeof item!=='object'||visited.has(item))continue;
      visited.add(item);nodes.push(item);
      if(Array.isArray(item)){queue.push(...item.slice(0,120));continue;}
      for(const key of ['payload','data','detail','result','field','map','mobs','monsters','entities','spawns']){
        const value=item[key];
        if(Array.isArray(value))queue.push(...value.slice(0,120));
        else if(value&&typeof value==='object')queue.push(value);
      }
    }
    return nodes;
  }
  function shinyFrom(packet){
    if(!mapSightingsPacket(packet))return [];
    const byKey=new Map();
    for(const item of mapNodes(packet,320)){
      if(!(item.shiny===true||item.isShiny===true||item.shiny_state===true))continue;
      if(item.dead||item.isDead||item.killed||item.respawning||item.isRespawning||Number(item.hp)===0)continue;
      // A real sighting must identify a Pokémon AND a map position/entity.
      const identityFields=[item.speciesId,item.pokeId,item.pokemonId,item.species,item.speciesName,item.pokemonName,item.name];
      if(!identityFields.some(x=>x!==undefined&&x!==null&&String(x).trim()))continue;
      const {name,speciesId}=speciesIdentity(item);
      const row=item.row??item.y??item.position?.row??item.position?.y;
      const col=item.col??item.x??item.position?.col??item.position?.x;
      const hasPos=row!==null&&row!==undefined&&col!==null&&col!==undefined&&Number.isFinite(Number(row))&&Number.isFinite(Number(col));
      const position=hasPos?String(row)+':'+String(col):'?:?';
      const entity=item.mobId??item.entityId??item.spawnId??item.slot??item.id;
      if(!hasPos&&(entity===undefined||entity===null))continue;
      const species=speciesId?'#'+speciesId:normalizeName(name);
      const key=species+'@'+(hasPos?position:'entity:'+String(entity));
      const record={name,key,position,speciesId,entityId:entity==null?null:String(entity),t:Date.now()};
      const existing=byKey.get(key);
      if(!existing||(/^(?:\d+|Pokémon #\d+)$/i.test(existing.name)&&!/^(?:\d+|Pokémon #\d+)$/i.test(name)))byKey.set(key,record);
    }
    return [...byKey.values()];
  }
  function shinySpeciesKey(entry){
    const name=normalizedShinyName(entry.name);
    const id=Number(entry.speciesId)||idBySpecies.get(name.toLowerCase())||Number(name.match(/^Pokémon #([0-9]+)$/i)?.[1])||null;
    return id?'#'+id:normalizeName(name);
  }
  function sameShinySpecies(a,b){return shinySpeciesKey(a)===shinySpeciesKey(b);}
  function isUnresolvedSpecies(entry){return /^(?:\d+|Pokémon #\d+)$/i.test(String(entry.name||''));}
  function sameUnresolvedSighting(a,b){
    return a.position!=='?:?'&&a.position===b.position&&
      (isUnresolvedSpecies(a)||isUnresolvedSpecies(b))&&
      (!a.speciesId||!b.speciesId||a.speciesId===b.speciesId);
  }
  // Merge old numeric/name duplicates without dropping encounters far apart.
  function normalizeShinyHistory(history,windowMs=90000){
    const out=[];
    for(const raw of Array.isArray(history)?history:[]){
      if(!raw||typeof raw!=='object')continue;
      const name=normalizedShinyName(raw.name);
      const speciesId=Number(raw.speciesId)||idBySpecies.get(name.toLowerCase())||Number(name.match(/^Pokémon #([0-9]+)$/i)?.[1])||null;
      const timestamp=Number(raw.t)||Date.now();
      const position=String(raw.position||'?:?');
      const canonical=speciesId?'#'+speciesId:normalizeName(name);
      const entry={...raw,name,speciesId,position,key:canonical+'@'+position,t:timestamp};
      const duplicate=out.find(x=>(sameShinySpecies(x,entry)||sameUnresolvedSighting(x,entry))&&Math.abs(x.t-entry.t)<windowMs);
      if(duplicate){
        // Keep the earliest sighting time and prefer a readable name/position.
        duplicate.t=Math.min(duplicate.t,entry.t);
        if(/^(?:\d+|Pokémon #\d+)$/i.test(duplicate.name)&&!/^(?:\d+|Pokémon #\d+)$/i.test(entry.name))duplicate.name=entry.name;
        if(duplicate.position==='?:?'&&entry.position!=='?:?')duplicate.position=entry.position;
        if(!duplicate.entityId&&entry.entityId)duplicate.entityId=entry.entityId;
        duplicate.speciesId=duplicate.speciesId||entry.speciesId;
        duplicate.key=(duplicate.speciesId?'#'+duplicate.speciesId:normalizeName(duplicate.name))+'@'+duplicate.position;
        continue;
      }
      out.push(entry);
    }
    return out.slice(0,120);
  }
  // The same spawn can be described by multiple packets, names, coordinates
  // and entity IDs. Keep a live encounter registry instead of a 30s key TTL.
  function createShinyEncounterTracker({cooldownMs=10*60*1000,positionCooldownMs=60*60*1000}={}){
    let sightings=[];
    function observe(raw,at=Date.now()){
      const event=normalizeShinyHistory([raw])[0];
      if(!event)return {isNew:false,event:null};
      const tick=Number(at)||Date.now();
      sightings=sightings.filter(s=>tick-s.lastAt<positionCooldownMs);
      const found=sightings.find(s=>{
        if(!sameShinySpecies(s.event,event)&&!sameUnresolvedSighting(s.event,event))return false;
        const samePosition=s.event.position!=='?:?'&&s.event.position===event.position;
        const sameEntity=s.event.entityId&&event.entityId&&s.event.entityId===event.entityId;
        return (samePosition||sameEntity)?tick-s.lastAt<positionCooldownMs:tick-s.lastAt<cooldownMs;
      });
      if(found){
        found.lastAt=tick;
        if(/^(?:\d+|Pokémon #\d+)$/i.test(found.event.name)&&!/^(?:\d+|Pokémon #\d+)$/i.test(event.name))found.event.name=event.name;
        if(found.event.position==='?:?'&&event.position!=='?:?')found.event.position=event.position;
        return {isNew:false,event:found.event};
      }
      sightings.push({event,lastAt:tick});
      return {isNew:true,event};
    }
    function prime(history,at=Date.now()){
      for(const item of [...(Array.isArray(history)?history:[])].reverse()){
        if(item&&Number(item.t)&&at-Number(item.t)<positionCooldownMs)observe(item,Number(item.t));
      }
    }
    return {observe,prime,reset(){sightings=[];},get size(){return sightings.length;}};
  }
  function captureFrom(packet){const arr=[];for(const item of packetNodes(packet,75)){
    const type=text(item.type||item.event||item.action||item.kind,50).toLowerCase();
    if(!/(catch.result|catch_result|capture.result|capture_result)/.test(type))continue;
    const result=typeof item.success==='boolean'?item.success:typeof item.caught==='boolean'?item.caught:/^(success|caught)$/i.test(String(item.result||item.status||''));
    arr.push({name:text(item.speciesName||item.pokemonName||item.pokemon||item.species||item.name||'Desconhecido',70),ball:text(item.ballName||item.ball||item.pokeball||'Poké Ball',50),success:result,shiny:item.shiny===true,auto:item.auto===true||item.isAuto===true,t:Date.now()});
  }return arr;}
  function killFrom(packet){const arr=[];for(const item of packetNodes(packet,80)){
    if(String(item.type||'').toLowerCase()!=='field-kill')continue;
    arr.push({xp:positive(item.xpGained)??0,totalXp:positive(item.totalXp),level:positive(item.level),name:text(item.speciesName||item.pokemonName||'—',70),parts:typeof item.xpParts==='object'&&item.xpParts?Object.fromEntries(Object.entries(item.xpParts).slice(0,12).map(([k,v])=>[text(k,30),positive(v)||0])):{},loot:Array.isArray(item.loot)?item.loot.slice(0,30).map(i=>({name:text(i.name||i.itemName||i.itemId||'Item',50),qty:positive(i.qty??i.quantity)??1})):[],t:Date.now()});
  }return arr;}
  function qualityLabel(q){if(q===null||!Number.isFinite(Number(q)))return 'Indefinida';const v=Number(q);return v<1?'Fraca':v<1.1?'Comum':v<1.3?'Incomum':v<1.5?'Rara':v<1.7?'Épica':v<2?'Lendária':v<3?'Mítica':v<4?'Anciã':'Divina';}
  scope.CommunityCore={STAT_NAMES,TYPE_PT,num,positive,text,escape,format,short,typeCode,typeMatrix,parseTooltip,formatPokemonSheet,estimateIV,normalizeName,xpForLevel,huntRates,shinyFrom,normalizeShinyHistory,createShinyEncounterTracker,registerSpeciesCatalog,normalizedShinyName,captureFrom,killFrom,qualityLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.CommunityCore;
})(typeof globalThis!=='undefined'?globalThis:this);
