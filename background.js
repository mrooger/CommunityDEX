'use strict';
const CACHE_TIME=14*86400000;
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(msg?.action!=='base-stats')return false;
  let allowed=false;
  try{const u=new URL(sender?.url||'');allowed=u.protocol==='https:'&&u.hostname==='poke.idleworld.online';}catch{}
  if(!allowed){reply({error:'Origem não permitida'});return false;}
  const raw=String(msg?.species||'').toLowerCase();
  if(!/^[a-z0-9-]{1,70}$/.test(raw)){reply({error:'Nome inválido'});return false;}
  (async()=>{
    const key='sd-base:'+raw;
    const cached=(await chrome.storage.local.get(key))[key];
    if(cached&&Date.now()-cached.savedAt<CACHE_TIME&&cached.image){reply({base:cached.base,types:cached.types,image:cached.image,cached:true});return;}
    const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),6000);
    try{
      const response=await fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(raw),{signal:ctrl.signal,cache:'force-cache'});
      if(!response.ok)throw Error('PokeAPI HTTP '+response.status);
      const data=await response.json();
      const b={};const fields={'hp':'hp','attack':'atk','defense':'def','special-attack':'spa','special-defense':'spd','speed':'spe'};
      for(const st of data.stats||[]){const key=fields[st.stat?.name];if(key)b[key]=Number(st.base_stat);}
      if(Object.keys(b).length!==6)throw Error('Atributos incompletos');
      const types=(data.types||[]).map(t=>String(t.type?.name||'').slice(0,30));
      const candidate=String(data.sprites?.other?.['official-artwork']?.front_default||data.sprites?.front_default||'');
      const image=/^https:\/\/(?:raw\.githubusercontent\.com|.*\.githubusercontent\.com|raw\.github\.com|.*\.pokemon\.com|.*\.pokeapi\.co)\//i.test(candidate)?candidate:'';
      await chrome.storage.local.set({[key]:{base:b,types,image,savedAt:Date.now()}});
      reply({base:b,types,image});
    }catch(e){reply({error:String(e?.message||e).slice(0,90)});}finally{clearTimeout(timeout);}
  })();
  return true;
});
