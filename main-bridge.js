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
  function handle(raw){
    messages++;
    if(messages===1 || messages%20===0)send('heartbeat',{messages,sockets,t:Date.now()});
    if(typeof raw!=='string'||raw.length>750000)return;
    const packetType=raw.match(/"(?:type|event|kind)"\s*:\s*"([^"\\]{1,65})"/)?.[1]?.toLowerCase()||'';
    const hasShiny=/"(?:shiny|isShiny|shiny_state)"\s*:\s*true\b/.test(raw);
    const trackedType=/^(field-kill|poke-xp|catch-result|catch_result|capture-result|capture_result|analyzer|field)$/.test(packetType);
    if(!trackedType&&!hasShiny)return;
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
