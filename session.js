/* Community Dex — daily statistics and local report model. */
(function(scope){
  'use strict';
  const DAY=86400000;
  const RARITIES=['Fraca','Comum','Incomum','Raro','Épico','Lendário','Mítica','Anciã','Divina'];
  const finite=v=>Number.isFinite(Number(v))?Number(v):0;
  const nonneg=v=>Math.max(0,finite(v));
  const fresh=(startAt=Date.now())=>({startAt,kills:0,xp:0,attempts:0,captures:0,shinyCaptures:0,shinyEncounters:0,parts:{},loot:{},balls:{},recentCaptures:[],shinyHistory:[],bestCapture:null,partial:false});
  const rarityFromQuality=q=>{const n=Number(q);return q==null||!Number.isFinite(n)||n<=0?null:n<1?'Fraca':n<1.1?'Comum':n<1.3?'Incomum':n<1.5?'Raro':n<1.7?'Épico':n<2?'Lendário':n<3?'Mítica':n<4?'Anciã':'Divina';};
  const rarity=(label,quality)=>{
    const calculated=rarityFromQuality(quality);
    if(calculated)return calculated;
    if(typeof label==='string'){
      const t=label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      const names={weak:'Fraca',fraca:'Fraca',common:'Comum',comum:'Comum',uncommon:'Incomum',incomum:'Incomum',rare:'Raro',raro:'Raro',rara:'Raro',epic:'Épico',epico:'Épico',epica:'Épico',legendary:'Lendário',lendario:'Lendário',lendaria:'Lendário',mythic:'Mítica',mitica:'Mítica',ancient:'Anciã',ancia:'Anciã',divine:'Divina',divina:'Divina'};
      if(names[t])return names[t];
    }
    return null;
  };
  function filterCaptures(history,tab='all',selected=RARITIES){
    const allowed=new Set(Array.isArray(selected)?selected:RARITIES);
    return (Array.isArray(history)?history:[]).filter(c=>(tab==='all'||(tab==='shiny'?c.shiny===true:c.shiny!==true))&&allowed.has(rarity(c.rarity,c.quality)||'Não informada'));
  }
  function addKill(s,k){s.kills++;s.xp+=nonneg(k.xp);for(const [name,v] of Object.entries(k.parts||{}))s.parts[name]=(s.parts[name]||0)+nonneg(v);for(const item of k.loot||[]){const name=String(item.name||'Item').slice(0,80);s.loot[name]=(s.loot[name]||0)+nonneg(item.qty);}}
  function addCapture(s,c){s.attempts++;const ball=String(c.ball||'Poké Ball').slice(0,60);s.balls[ball]??={tries:0,wins:0};s.balls[ball].tries++;if(c.success){s.captures++;s.balls[ball].wins++;if(c.shiny)s.shinyCaptures++;s.recentCaptures.unshift({...c,rarity:rarity(c.rarity,c.quality)});s.recentCaptures.length=Math.min(200,s.recentCaptures.length);refreshBest(s);}}
  const strength=c=>{
    const power=Number(c?.power),quality=Number(c?.quality),iv=Number(c?.ivTotal);
    const hasPower=c?.power!=null&&Number.isFinite(power)&&power>0;
    const hasQuality=c?.quality!=null&&Number.isFinite(quality)&&quality>0;
    const hasIv=c?.ivTotal!=null&&Number.isFinite(iv)&&iv>=0;
    if(!hasPower&&!hasQuality&&!hasIv)return null;
    return {power:hasPower?power:null,quality:hasQuality?quality:null,iv:hasIv?iv:null};
  };
  const stronger=(a,b)=>{
    const x=strength(a),y=strength(b);
    if(!x)return false;if(!y)return true;
    if(x.power!==null&&y.power!==null&&x.power!==y.power)return x.power>y.power;
    if(x.quality!==null&&y.quality!==null&&x.quality!==y.quality)return x.quality>y.quality;
    if(x.iv!==null&&y.iv!==null&&x.iv!==y.iv)return x.iv>y.iv;
    return [x.power!==null,x.quality!==null,x.iv!==null].filter(Boolean).length>
      [y.power!==null,y.quality!==null,y.iv!==null].filter(Boolean).length;
  };
  function refreshBest(s){
    for(const c of s.recentCaptures||[])if(stronger(c,s.bestCapture))s.bestCapture={...c,rarity:rarity(c.rarity,c.quality)};
    return s.bestCapture;
  }
  function enrichCapture(s,c){
    const target=(s.recentCaptures||[]).find(x=>x.t===c.t&&x.name===c.name);
    if(!target)return false;
    for(const key of ['quality','ivTotal','ivMax','rarity','power','pokemonId'])if(c[key]!=null)target[key]=c[key];
    target.rarity=rarity(target.rarity,target.quality);
    if(s.bestCapture?.t===target.t&&s.bestCapture?.name===target.name)s.bestCapture={...target};
    refreshBest(s);return true;
  }
  function addShiny(s,e){s.shinyEncounters++;s.shinyHistory.unshift({name:String(e.name||'Shiny').slice(0,90),speciesId:e.speciesId||null,position:e.position||'',t:finite(e.t)||Date.now()});s.shinyHistory.length=Math.min(200,s.shinyHistory.length);}
  function snapshot(s,endAt=Date.now(),kind='daily'){
    const end=Math.max(s.startAt,finite(endAt));const elapsed=Math.max(1,(end-s.startAt)/3600000);
    return {id:`${kind}-${s.startAt}-${end}`,kind,createdAt:Date.now(),startAt:s.startAt,endAt:end,partial:Boolean(s.partial),summary:{kills:s.kills,xp:s.xp,captures:s.captures,normalCaptures:s.captures-s.shinyCaptures,shinyCaptures:s.shinyCaptures,shinyEncounters:s.shinyEncounters,attempts:s.attempts,xpHour:Math.round(s.xp/elapsed),killsHour:Math.round(s.kills/elapsed)},parts:{...s.parts},loot:Object.fromEntries(Object.entries(s.loot).sort((a,b)=>b[1]-a[1]).slice(0,60)),balls:{...s.balls},bestCapture:s.bestCapture?{...s.bestCapture}:null,captures:s.recentCaptures.slice(0,200),shinies:s.shinyHistory.slice(0,200)};
  }
  const isActive=s=>s.kills>0||s.attempts>0||s.shinyEncounters>0;
  function rotate(s,at=Date.now()){
    if(!Number.isFinite(s?.startAt)||at-s.startAt<DAY)return {session:s,closed:null};
    const end=s.startAt+DAY;
    return {session:fresh(at),closed:isActive(s)?snapshot(s,end,'daily'):null};
  }
  function prune(logs,kind,at=Date.now()){
    const items=(Array.isArray(logs)?logs:[]).filter(x=>x&&x.kind===kind&&Number.isFinite(x.endAt));
    return items.filter(x=>kind==='manual'||at-x.endAt<=5*DAY).sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  }
  function bonuses(parts){
    const base=nonneg(parts.base);if(!base)return [];
    return Object.entries(parts).filter(([k,v])=>k!=='base'&&nonneg(v)>0).map(([key,value])=>({key,rate:Math.round(nonneg(value)/base*1000)/10,value:nonneg(value)}));
  }
  function currentBonuses(kills,at=Date.now()){
    const recent=(Array.isArray(kills)?kills:[]).filter(k=>k&&k.parts&&Number(k.parts.base)>0&&k.t<=at&&at-k.t<15*60*1000).slice(-12);
    if(!recent.length)return [];
    const keys=[...new Set(recent.flatMap(k=>Object.keys(k.parts)).filter(k=>k!=='base'))];
    const tiers=[15,17.5,20,22.5,25];
    const result=[];
    for(const key of keys){
      const points=recent.slice(-7).map(k=>{
        const b=Number(k.parts.base),v=Number(k.parts[key]||0);
        return b>0&&Number.isFinite(v)?100*v/b:null;
      }).filter(v=>v!==null);
      if(!points.length)continue;
      const newest=points.slice(-4),sorted=[...newest].sort((a,b)=>a-b);
      let rate=sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
      if(rate<=0)continue;
      if(/^(?:stream|streamer|twitch)$/i.test(key)){
        const closest=tiers.reduce((a,b)=>Math.abs(b-rate)<Math.abs(a-rate)?b:a,tiers[0]);
        if(Math.abs(rate-closest)<=0.85)rate=closest;
        else rate=Math.round(rate*2)/2;
      }else rate=Math.round(rate*2)/2;
      result.push({key,rate,value:Math.round(recent.reduce((sum,k)=>sum+(Number(k.parts[key])||0),0)),samples:newest.length});
    }
    return result;
  }
  function fromLegacy(kills=[],captures=[],shinies=[],at=Date.now()){
    const s=fresh(at);s.partial=true;
    for(const k of kills||[])addKill(s,k);
    for(const c of [...(captures||[])].reverse())addCapture(s,c);
    for(const e of [...(shinies||[])].reverse())addShiny(s,e);
    return s;
  }
  scope.CommunitySession={DAY,RARITIES,fresh,rarity,filterCaptures,addKill,addCapture,enrichCapture,refreshBest,addShiny,snapshot,rotate,prune,bonuses,currentBonuses,fromLegacy};
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.CommunitySession;
})(typeof globalThis!=='undefined'?globalThis:this);
