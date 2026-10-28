'use strict';
const CACHE_TIME=14*86400000;
const RELEASES_URL='https://api.github.com/repos/mrooger/CommunityDEX/releases/latest';
const RELEASES_PAGE='https://github.com/mrooger/CommunityDEX/releases';
const UPDATE_CACHE_MS=30*60*1000;
let releaseCache=null;
let releasePending=null;
function parseRelease(data){
  const version=String(data?.tag_name||'').replace(/^v/i,'');
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Versão não reconhecida');
  const url=String(data?.html_url||'');
  if(!/^https:\/\/github\.com\/mrooger\/CommunityDEX\/releases\/tag\/v?\d+\.\d+\.\d+$/.test(url))throw Error('Endereço de release inválido');
  const asset=(Array.isArray(data.assets)?data.assets:[]).find(item=>{
    const link=String(item.browser_download_url||'');
    return /^https:\/\/github\.com\/mrooger\/CommunityDEX\/releases\/download\/v?\d+\.\d+\.\d+\/[^\/?#]+\.zip$/i.test(link);
  });
  return {version:'v'+version,url,downloadUrl:asset?.browser_download_url||''};
}
async function getRelease(force){
  if(!force&&releaseCache&&Date.now()-releaseCache.savedAt<UPDATE_CACHE_MS)return releaseCache.data;
  if(releasePending)return releasePending;
  releasePending=(async()=>{
    const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),8500);
    try{
      const response=await fetch(RELEASES_URL,{headers:{Accept:'application/vnd.github+json'},signal:ctrl.signal,cache:'no-store'});
      if(!response.ok)throw Error(response.status===403?'Limite de consultas atingido. Tente mais tarde.':'GitHub indisponível (HTTP '+response.status+')');
      const data=parseRelease(await response.json());
      releaseCache={data,savedAt:Date.now()};
      return data;
    }finally{clearTimeout(timeout);releasePending=null;}
  })();
  return releasePending;
}

chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(!['base-stats','species-catalog','check-update'].includes(msg?.action))return false;
  let allowed=false;
  try{const u=new URL(sender?.url||'');allowed=u.protocol==='https:'&&u.hostname==='poke.idleworld.online';}catch{}
  if(!allowed){reply({error:'Origem não permitida'});return false;}
  if(msg.action==='check-update'){
    getRelease(Boolean(msg.force)).then(reply).catch(e=>reply({error:String(e.message||e).slice(0,140),url:RELEASES_PAGE}));
    return true;
  }
  if(msg.action==='species-catalog') {
    (async()=>{
      const key='sd-species-catalog';
      try{
        const cached=(await chrome.storage.local.get(key))[key];
        if(cached&&Date.now()-cached.savedAt<CACHE_TIME&&Array.isArray(cached.creatures)){reply({creatures:cached.creatures});return;}
        const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);
        try{
          const response=await fetch('https://pokeapi.co/api/v2/pokemon?limit=1302&offset=0',{signal:controller.signal,cache:'force-cache'});
          if(!response.ok)throw Error('Catálogo indisponível');
          const data=await response.json();
          const creatures=(data.results||[]).map(entry=>({pokeId:Number(String(entry.url||'').match(/\/pokemon\/(\d+)\//)?.[1]),name:String(entry.name||'').slice(0,70)})).filter(entry=>Number.isInteger(entry.pokeId)&&entry.pokeId>0&&entry.name);
          await chrome.storage.local.set({[key]:{creatures,savedAt:Date.now()}});
          reply({creatures});
        }finally{clearTimeout(timer);}
      }catch(error){reply({error:String(error?.message||error).slice(0,90)});}
    })();
    return true;
  }
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
