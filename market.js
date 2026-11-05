/* Community Dex · Global Market Pokémon reader */
(function(scope){
  'use strict';
  const C=scope.CommunityCore||(typeof require==='function'?require('./core.js'):null);
  const STAT_KEYS=['hp','atk','def','spa','spd','spe'];
  function statKey(label){
    const raw=String(label||'').replace(/\u00a0/g,' ').trim();
    // The game uses SpD for Special Defense and Spd for Speed.
    if(/^SpD(?![a-z])/u.test(raw))return 'spd';
    if(/^Spd(?![a-z])/u.test(raw))return 'spe';
    if(/^SpA(?![a-z])/u.test(raw))return 'spa';
    const s=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[._:()/-]+/g,' ').replace(/\s+/g,' ').trim();
    if(/^(?:hp|ps|vida|saude|max hp)(?:\b|$)/.test(s))return 'hp';
    if(/^(?:sp def|spdef|special def(?:ense)?|def(?:esa)? (?:esp|especial|special)|defesp|def sp|sp d)(?:\b|$)/.test(s))return 'spd';
    if(/^(?:spa|sp atk|sp attack|spatk|special att(?:ack)?|at(?:a)?q(?:ue)? (?:esp|especial|special)|atk esp|atkesp|atqesp|sp a)(?:\b|$)/.test(s))return 'spa';
    if(/^(?:speed|spe|spd|vel(?:ocidade)?)(?:\b|$)/.test(s))return 'spe';
    if(/^(?:def(?:ense|esa)?|def)(?:\b|$)/.test(s))return 'def';
    if(/^(?:atk|attack|ataque|atq)(?:\b|$)/.test(s))return 'atk';
    return null;
  }
  const contents=el=>String(el?.innerText||el?.textContent||'').replace(/\u00a0/g,' ').trim();
  function parseDetails(details,selected){
    if(!details?.querySelector)return null;
    const title=contents(details.querySelector('.mkt2-details-name'));
    const lv=title.match(/(?:lv\.?|lvl|level|nv\.?|n[ií]vel)\s*[:\-]?\s*(\d+)/i);
    if(!lv)return null;
    const name=title.replace(/(?:lv\.?|lvl|level|nv\.?|n[ií]vel)\s*[:\-]?\s*\d+/i,'').trim();
    const level=Number(lv[1]);
    if(!name||level<1||level>10000)return null;
    const cells=[...details.querySelectorAll('.mkt2-stats .mkt2-statcell')];
    if(cells.length<4)return null;
    const stats=Object.fromEntries(STAT_KEYS.map(k=>[k,null]));
    const unknown=[];
    let matched=0;
    for(let i=0;i<cells.length;i++){
      const cell=contents(cells[i]);
      const label=contents(cells[i].querySelector('.mkt2-statlabel,.mkt2-stat-label,.mkt2-statname,.mkt2-stat-name,.label,small'));
      const key=statKey(label)||statKey(cell);
      const valueText=contents(cells[i].querySelector('.mkt2-statvalue,.mkt2-stat-value,.mkt2-value,.value'))||cell;
      const values=valueText.match(/\d[\d.,]*/g)||[];
      const value=values.length?C.num(values[0]):null;
      if(key&&value!==null){
        // Never overwrite a stat with a different value from another cell.
        if(stats[key]!==null&&stats[key]!==value)return null;
        stats[key]=value;
        matched++;
      }else unknown.push({index:i,value});
    }
    // Positional reading is only safe when *no* stat has a recognizable label.
    if(matched===0&&cells.length===6){
      for(const {index,value} of unknown)if(value!==null)stats[STAT_KEYS[index]]=value;
    }else if(matched===5&&unknown.length===1){
      const missing=STAT_KEYS.filter(key=>stats[key]===null);
      if(missing.length===1&&unknown[0].value!==null)stats[missing[0]]=unknown[0].value;
    }
    if(Object.values(stats).filter(v=>v!==null).length<4)return null;
    const raw=contents(details);
    const selection=contents(selected);
    const rarityLine=raw.match(/(?:raridade|rarity|qualidade|quality)\s*[:\-]?\s*([^\n]+)/i)?.[1]||'';
    const qMatch=(rarityLine||raw).match(/(?:×|x)\s*(\d+(?:[.,]\d+)?)/i)
       ||raw.match(/\b(?:quality|qualidade)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i);
    const quality=qMatch?C.num(qMatch[1]):null;
    const iv=(raw+'\n'+selection).match(/\bIV(?:\s*total)?\s*[:\-]?\s*(\d{1,3})(?:\s*\/\s*(\d{2,3}))?/i);
    const power=raw.match(/(?:poder|power)\s*[:\-]?\s*([\d.,]+)/i);
    const types=[...new Set([...details.querySelectorAll('.mkt2-card-badges span,.mkt2-statlist span')]
      .flatMap(el=>contents(el).split(/[,/·|]+/))
      .map(item=>C.typeCode(item.trim())).filter(Boolean))].slice(0,2);
    return {name,level,quality:quality??1,ivTotal:iv?Number(iv[1]):null,ivMax:iv?Number(iv[2]||192):null,
      power:power?C.num(power[1]):null,types,stats,source:'market',timestamp:Date.now()};
  }
  scope.CommunityMarket={parseDetails};
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.CommunityMarket;
})(typeof globalThis!=='undefined'?globalThis:this);
