/* Community Dex — read-only capture-log parsing and record reconciliation. */
(function(scope){
  'use strict';
  const LABELS=[
    ['Lendário',/\b(?:lend[áa]ri[oa]|legendary)\b/i],
    ['Incomum',/\b(?:incomum|uncommon)\b/i],
    ['Comum',/\b(?:comum|common)\b/i],
    ['Raro',/\b(?:rar[oa]|rare)\b/i],
    ['Épico',/\b(?:[ée]pic[oa]?|epic)\b/i],
    ['Mítica',/\b(?:m[ií]tic[oa]|mythic)\b/i],
    ['Anciã',/\b(?:anci[ãa]|ancient)\b/i],
    ['Divina',/\b(?:divin[oa]|divine)\b/i],
    ['Fraca',/\b(?:frac[oa]|weak)\b/i]
  ];
  const normalize=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  const amount=s=>Number(String(s).replace(',','.'));
  const textOf=el=>String(el?.innerText||el?.textContent||'').trim();
  const isMetadata=m=>m&&(m.rarity!=null||m.quality!=null||m.ivTotal!=null);
  function extract(text,metaText=text){
    const detail=String(metaText??'').replace(/\u00a0/g,' ').slice(0,2000);
    const all=String(text??'').replace(/\u00a0/g,' ').slice(0,3200);
    const matched=LABELS.find(([,re])=>re.test(detail)||re.test(all));
    const rarity=matched?.[0]||null;
    const ivRe=/(?:\bIVs?\b\s*[:=\-]?\s*(\d{1,3})(?:\s*\/\s*(192|186))?|\b(\d{1,3})\s*\/\s*192\s*IVs?\b)/i;
    const ivMatch=detail.match(ivRe)||all.match(ivRe);
    const ivCandidate=ivMatch?Number(ivMatch[1]||ivMatch[3]):null;
    const ivTotal=ivCandidate!==null&&ivCandidate>=0&&ivCandidate<=192?ivCandidate:null;
    const qualityRe=/(?:\b(?:quality|qualidade|multiplicador|raridade)\s*[:=]?\s*|[×x]\s*)([0-9]+[.,][0-9]{1,3})\s*[×x]?/i;
    const qualityMatch=detail.match(qualityRe)||all.match(qualityRe);
    const quality=qualityMatch?amount(qualityMatch[1]):null;
    return {rarity,quality:quality!=null&&quality>=0.5&&quality<=10?quality:null,ivTotal,ivMax:ivMatch?.[2]?Number(ivMatch[2]):192};
  }
  function attributes(el){
    if(!el)return '';
    const names=['title','aria-label','data-rarity','data-quality','data-iv','data-ivs','data-iv-total','data-multiplier'];
    const a=names.map(name=>{try{const value=el.getAttribute?.(name);return value?`${name} ${value}`:'';}catch{return '';}}).filter(Boolean);
    if(el.dataset)a.push(...Object.entries(el.dataset).filter(([key])=>/^(?:rarity|quality|iv|ivs|ivTotal|multiplier)$/i.test(key)).map(([key,value])=>`${key} ${value}`));
    return a.join(' ');
  }
  function rowContent(row){
    const nodes=[row,...Array.from(row.querySelectorAll?.('.clog-meta,.clog-name,.clog-iv,.clog-quality,[title],[data-quality],[data-iv],[data-rarity]')||[]).slice(0,40)];
    return nodes.map(attributes).filter(Boolean).join(' ');
  }
  function parseClock(s){
    const value=String(s||'');
    const match=value.match(/(?:^|\D)([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?(?!\d)/);
    return match?{clock:`${match[1].padStart(2,'0')}:${match[2]}:${match[3]||'00'}`,precision:match[3]?'second':'minute'}:null;
  }
  function parseRow(row){
    if(!row||typeof row.querySelector!=='function')return null;
    const meta=row.querySelector('.clog-meta,[class*="capture-meta"],[class*="clog-details"]');
    const detail=[textOf(meta),rowContent(row)].filter(Boolean).join(' ');
    const raw=textOf(row);
    const details=extract(raw,detail||raw);
    if(!isMetadata(details))return null;
    const label=row.querySelector('.clog-name,.clog-pokemon,.clog-species,.clog-mon,.clog-poke-name,[class*="clog-name"],[class*="clog-species"]');
    const directName=label?.childNodes?Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent||'').join(' ').trim():'';
    let name=String(directName||textOf(label)).trim().slice(0,70);
    if(!name&&meta){
      const before=raw.includes(textOf(meta))?raw.slice(0,raw.indexOf(textOf(meta))):'';
      const candidate=before.split(/[\n\r|·•]/).map(s=>s.trim()).filter(Boolean).at(-1)||'';
      if(candidate.length<=70&&!/^(?:captur|shiny|normal|sucesso|pok[eé]\s*ball|ultra\s*ball)/i.test(candidate))name=candidate;
    }
    const id=row.dataset?.pokemonId||row.dataset?.pokeId||row.dataset?.uid||row.dataset?.instanceId||row.querySelector?.('[data-pokemon-id]')?.dataset?.pokemonId||null;
    const timeEl=row.querySelector('.clog-when,.clog-time,[class*="clog-when"]');
    const time=parseClock(textOf(timeEl)||raw);
    return {...details,name,pokemonId:id,clock:time?.clock||null,clockPrecision:time?.precision||null};
  }
  function minutesApart(clock,time,precision='minute'){
    if(!clock)return Infinity;
    const values=clock.split(':').map(Number);
    const d=new Date(time),minutes=d.getHours()*60+d.getMinutes(),current=values[0]*60+values[1];
    const gap=Math.abs(minutes-current);
    const dayGap=Math.min(gap,1440-gap);
    if(precision==='second'){
      const total=dayGap*60+Math.abs(d.getSeconds()-(values[2]||0));
      return total/60;
    }
    return dayGap;
  }
  function isValid(c,at){return Boolean(c?.success)&&Number.isFinite(Number(c.t))&&at-c.t>=-3000&&at-c.t<=24*60*60*1000;}
  function matchesSpecies(row,c){return !normalize(row.name)||normalize(row.name)===normalize(c.name);}
  function chooseCapture(meta,captures,at=Date.now()){
    if(!meta||!Array.isArray(captures))return null;
    let matches=captures.filter(c=>isValid(c,at)&&matchesSpecies(meta,c));
    if(meta.pokemonId){
      const identified=matches.filter(c=>c.pokemonId!=null&&String(c.pokemonId)===String(meta.pokemonId));
      if(identified.length===1)return identified[0];
      matches=matches.filter(c=>c.pokemonId==null);
    }
    if(meta.clock){
      const near=matches.filter(c=>minutesApart(meta.clock,c.t,meta.clockPrecision)<=(meta.clockPrecision==='second'?1:1.5));
      if(near.length===1)return near[0];
      return null;
    }
    if(!normalize(meta.name)&&!meta.pokemonId)return null;
    const eligible=matches.filter(c=>!c.metadataMatched||meta.ivTotal!=null&&c.ivTotal==null||meta.quality!=null&&c.quality==null);
    return eligible.length===1?eligible[0]:null;
  }
  function reconcileRows(rows,captures,at=Date.now()){
    const parsed=Array.from(rows||[]).slice(0,220).map(row=>({row,meta:parseRow(row)})).filter(x=>x.meta);
    const ordered=(captures||[]).filter(c=>isValid(c,at));
    const output=[],used=new Set();
    const link=(item,c)=>{if(!c||used.has(c))return false;used.add(c);output.push({row:item.row,meta:item.meta,capture:c});return true;};
    for(const item of parsed){
      const candidate=chooseCapture(item.meta,ordered.filter(c=>!used.has(c)),at);
      link(item,candidate);
    }
    // Capture-log entries are newest-first. Use their order only when the
    // newest entry is anchored to the latest recorded capture.
    if(!parsed.length||!ordered.length)return output;
    const first=parsed[0],firstCapture=ordered[0];
    const anchored=matchesSpecies(first.meta,firstCapture)&&(
      first.meta.clock?minutesApart(first.meta.clock,firstCapture.t,first.meta.clockPrecision)<=1.5:
      at-firstCapture.t<10*60*1000
    );
    if(!anchored)return output;
    const n=Math.min(parsed.length,ordered.length);
    for(let i=0;i<n;i++){
      if(used.has(ordered[i])||output.some(x=>x.row===parsed[i].row))continue;
      if(matchesSpecies(parsed[i].meta,ordered[i]))link(parsed[i],ordered[i]);
    }
    return output;
  }
  scope.CommunityCaptureLog={extract,parseRow,chooseCapture,reconcileRows};
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.CommunityCaptureLog;
})(typeof globalThis!=='undefined'?globalThis:this);
