/* MAIN world reader: passive, bounded, no outgoing game commands. */
(() => {
  'use strict';
  if (window.__communityDexBridgeInstalled || typeof window.WebSocket !== 'function') return;
  Object.defineProperty(window,'__communityDexBridgeInstalled',{value:true,configurable:false});
  const CH='__COMMUNITY_DEX_EVENTS_V1__';
  const send=(type,payload={})=>{
    try{window.postMessage({channel:CH,type,payload},location.origin);}catch{}
  };
  const NativeWS=window.WebSocket;
  const seen=new WeakSet();let sockets=0,messages=0;
  const tracked=new WeakSet();
  let knownPokes=null;
  function handle(raw){
    messages++;
    if(messages===1 || messages%20===0)send('heartbeat',{messages,sockets,t:Date.now()});
    if(typeof raw!=='string'||raw.length>1250000)return;
    const packetType=raw.match(/"(?:type|event|kind)"\s*:\s*"([^"\\]{1,65})"/)?.[1]?.toLowerCase()||'';
    const hasShiny=/"(?:shiny|isShiny|shiny_state)"\s*:\s*true\b/.test(raw);
    const trackedType=/^(field-kill|poke-xp|catch-result|catch_result|capture-result|capture_result|analyzer|field)$/.test(packetType);
    const mapType=/^(?:field|map|spawn)(?:[-_](?:state|update|sync|mobs|monsters|entities|snapshot|refresh|enter|spawn|batch))?$/.test(packetType);
    const mapCollection=/"(?:mobs|monsters|entities)"\s*:\s*\[/.test(raw);
    const nonMap=/^(?:inventory|pokes|pokemon|party|character|catch|capture|field-kill|poke-xp|market|shop|battle|combat|attack|analyzer)/.test(packetType);
    if(packetType==='pokes'){
      let packet;try{packet=JSON.parse(raw);}catch{return;}
      const list=Array.isArray(packet.list)?packet.list:Array.isArray(packet.pokes)?packet.pokes:null;
      if(!list||list.length>20000)return;
      const next=new Set();const added=[];
      for(const pokemon of list){
        if(!pokemon||typeof pokemon!=='object')continue;
        const id=pokemon.instanceId??pokemon.pokemonUid??pokemon.uid??pokemon.id;
        if(id==null||typeof id==='object')continue;
        const key=String(id);if(!key||key.length>90)continue;
        next.add(key);
        if(knownPokes&&!knownPokes.has(key)&&added.length<10){
          const meta={pokemonId:key};
          const keys=['name','speciesName','pokemonName','speciesId','pokeId','shiny','isShiny','quality','qualidade','qualityMultiplier','multiplier','q','rarity','raridade','qualityName','qualityTier','tier','ivTotal','totalIv','totalIV','iv','ivs','power','poder'];
          for(const field of keys){const value=pokemon[field];if(value==null)continue;
            if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')meta[field]=value;
            else if((field==='ivs'||field==='iv')&&value&&typeof value==='object'){
              const ivKeys=['hp','atk','def','spa','spd','spe'];
              if(ivKeys.every(k=>Number.isFinite(Number(value[k]))))meta[field]=Object.fromEntries(ivKeys.map(k=>[k,Number(value[k])]));
            }
          }
          added.push(meta);
        }
      }
      knownPokes=next;
      if(added.length&&added.length<=5)send('capture-meta',{pokemon:added,t:Date.now()});
      return;
    }
    if(!trackedType&&!(hasShiny&&(mapType||(mapCollection&&!nonMap))))return;
    if(packetType==='field'&&!hasShiny)return;
    let parsed;try{parsed=JSON.parse(raw);}catch{return;}
    // Do not forward authentication, inventory, character or profile packets.
    if(parsed===null||typeof parsed!=='object')return;
    // Strip sensitive account/session keys even if a future game packet contains them.
    const guarded=JSON.parse(JSON.stringify(parsed,(key,value)=>/^(?:token|accessToken|refreshToken|authorization|password|secret|credentials|email|session|cookie)$/i.test(key)?undefined:value));
    const data=JSON.stringify(guarded);
    if(data.length>350000)return;
    send('packet',{type:packetType,data:guarded});
  }
  function monitor(ws){
    if(!ws||tracked.has(ws))return ws;
    tracked.add(ws);sockets++;send('socket',{state:'created',sockets,messages,t:Date.now()});
    // Native listeners do not alter the game's event handlers or server traffic.
    const onMessage=event=>{
      if(event&&typeof event==='object'){if(seen.has(event))return;seen.add(event);}
      if(typeof event.data==='string')handle(event.data);
      else if(event.data instanceof ArrayBuffer && event.data.byteLength<350000){try{handle(new TextDecoder().decode(event.data));}catch{}}
    };
    try{NativeWS.prototype.addEventListener.call(ws,'message',onMessage);}catch{}
    try{NativeWS.prototype.addEventListener.call(ws,'open',()=>send('socket',{state:'open',sockets,messages,t:Date.now()}));}catch{}
    try{NativeWS.prototype.addEventListener.call(ws,'close',()=>send('socket',{state:'closed',sockets,messages,t:Date.now()}));}catch{}
    try{NativeWS.prototype.addEventListener.call(ws,'error',()=>send('socket',{state:'error',sockets,messages,t:Date.now()}));}catch{}
    return ws;
  }
  try{
    window.WebSocket=new Proxy(NativeWS,{construct(target,args,newTarget){return monitor(Reflect.construct(target,args,newTarget));}});
    send('bridge',{state:'ready',strategy:'MAIN World + WebSocket Proxy',t:Date.now()});
  }catch(err){send('bridge',{state:'error',reason:String(err?.message||err).slice(0,100)});}
})();
