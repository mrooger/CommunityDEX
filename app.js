/* Community Dex · Game companion */
(() => {
  'use strict';
  if(!/^\/play(?:\/|$)/.test(location.pathname) || window.__communityDexApp) return;
  window.__communityDexApp=true;
  const C=globalThis.CommunityCore;
  const M=globalThis.CommunitySession;
  const L=globalThis.CommunityCaptureLog;
  const CH='__COMMUNITY_DEX_EVENTS_V1__';
  const STORE='community-dex:v1';
  const LEGACY_STORE='stigal-dex:v1';
  const TAB_META=[['overview','Visão geral','◫'],['pokemon','Pokédex','◉'],['hunt','Hunt','⚡'],['captures','Capturas','◈'],['shiny','Shinies','✦'],['stream','Stream Geral','📹'],['settings','Ajustes','⚙']];
  const OPTIONAL_TABS=['overview','pokemon','hunt','captures','shiny','stream'];
  const SECTIONS={overview:[['overviewMetrics','Indicadores'],['overviewLogs','Histórico & Logs'],['overviewActivity','Atividade recente']],pokemon:[['pokemonTypes','Efetividades'],['pokemonStats','Atributos'],['pokemonManual','Leitura manual'],['pokemonHistory','Histórico de fichas']],hunt:[['huntLoot','Loot'],['huntComposition','Composição de XP'],['huntCalculator','Calculadora de XP']],captures:[['capturesBalls','Resultados por bola'],['capturesRecent','Últimas capturas']],shiny:[['shinyDetector','Detector e áudio'],['shinyHistory','Histórico de Shinies']],stream:[['streamMetrics','Indicadores'],['streamRecent','Últimas capturas']]};
  const DEFAULT_SECTIONS=Object.fromEntries(Object.values(SECTIONS).flat().map(([key])=>[key,true]));
  const DEFAULT_COLLAPSE={pokemonTypes:false,pokemonManual:false,huntComposition:false,huntCalculator:false,overviewLogs:false,overviewActivity:false,capturesBalls:false,shinyDetector:false};
  const PREF={enabled:true,autoPokemon:true,shiny:true,sound:false,toasts:true,shinyBadge:true,floatingButton:true,autoUpdateCheck:true,dexMode:'smart',compact:false,ivMax:32,opacity:96,tabOrder:OPTIONAL_TABS,tabVisible:{...Object.fromEntries(OPTIONAL_TABS.map(id=>[id,true])),stream:false},sectionVisible:DEFAULT_SECTIONS,expanded:DEFAULT_COLLAPSE};
  const XP_LABELS={base:'XP base',vip:'Bônus VIP',boost:'Bônus de XP',streak:'Bônus de sequência',event:'Bônus de evento',typeDay:'Bônus do tipo do dia',typeday:'Bônus do tipo do dia',stream:'Bônus da stream',streamer:'Bônus da stream',twitch:'Bônus da Twitch',pokedex:'Bônus da Pokédex',other:'Outros bônus'};
  const sectionShown=key=>state.prefs.sectionVisible[key]!==false;
  const sectionExpanded=key=>Boolean(state.prefs.expanded[key]);
  const expandable=(key,title,icon,inside,{open=false,count=''}={})=>`<div class="sd-panelcard sd-expandable"><button type="button" class="sd-collapse-head" data-action="toggle-section" data-section="${E(key)}" aria-expanded="${sectionExpanded(key)}"><span class="sd-section-icon">${icon}</span><span class="sd-grow"><b>${E(title)}</b>${count?`<small>${E(count)}</small>`:''}</span><span class="sd-chevron">${sectionExpanded(key)?'⌃':'⌄'}</span></button>${sectionExpanded(key)?`<div class="sd-collapse-content">${inside}</div>`:''}</div>`;
  const buttonMore=(action,expanded,total,limit)=>total>limit?`<button class="sd-more" data-action="${action}">${expanded?'Mostrar apenas '+limit:'Ver mais '+(total-limit)} <span>${expanded?'⌃':'⌄'}</span></button>`:'';
  const eventHtml=v=>`<div class="sd-event"><span class="sd-event-icon">${v.type==='shiny'?'✦':v.type==='capture'?'◈':'◉'}</span><span>${E(v.msg)}</span><time>${formatTime(v.t)}</time></div>`;
  const captureHtml=c=>{
    const rare=M.rarity(c.rarity,c.quality)||'Não informada';
    const iv=c.ivTotal!=null&&Number.isFinite(Number(c.ivTotal))?F(c.ivTotal)+(c.ivMax?'/'+F(c.ivMax):'/192'):'—';
    const tier=rare==='Não informada'?'unknown':C.normalizeName(rare);
    const quality=c.quality!=null&&Number(c.quality)>0?' · ×'+F(c.quality,2):'';
    const sprite=C.speciesSprite(c.name,c.shiny,c.spriteUrl,c.speciesId);
    const fallback=C.baseSprite(c.name,c.shiny);
    const backup=fallback&&fallback!==sprite?` data-sprite-fallback="${E(fallback)}"`:'';
    const icon=sprite?`<img class="sd-capture-sprite" src="${E(sprite)}"${backup} alt="" loading="lazy" referrerpolicy="no-referrer">`:'◉';
    return `<div class="sd-event sd-capture-row"><span class="sd-event-icon sd-capture-icon ${c.shiny?'sd-shinycap':''}">${icon}</span><span><b>${E(c.name)}</b> ${c.shiny?'<span class="sd-capture-shiny">Shiny</span>':''}<small> · ${E(c.ball)}</small><span class="sd-capture-details"><i data-rarity="${E(tier)}">${E(rare)}${E(quality)}</i><small>IV ${E(iv)}</small></span></span><time>${formatTime(c.t)}</time></div>`;
  };
  const state={
    prefs:structuredClone(PREF),tab:'overview',open:false,min:false,pos:null,bridge:'Aguardando',socket:'aguardando',wsMessages:0,lastPacket:0,
    pokemon:null,pinned:null,history:[],base:{},basePending:new Set(),baseErrors:{},
    kills:[],totalXp:null,level:null,parts:{},loot:{},session:M.fresh(),dailyLogs:[],manualLogs:[],captureTab:'all',captureSort:'recent',captureRarities:[...M.RARITIES,'Não informada'],rarityDropdownOpen:false,capturesFiltersExpanded:false,streamFiltersExpanded:false,streamCatchesExpanded:false,
    catches:[],shinyLog:[],shinyTracker:C.createShinyEncounterTracker(),
    feed:[],huntTarget:150,pokeTarget:100,activityExpanded:false,catchesExpanded:false,historyExpanded:false,lootExpanded:false,shinyExpanded:false,manualText:'',dockPos:null,completePos:null,completeSize:null,update:{status:'idle',version:'',url:'',downloadUrl:'',message:'',checkedAt:0}
  };
  const now=()=>Date.now();
  const E=C.escape,F=C.format,S=C.short;
  let host,panel,dock,body,alertBox,lastCaptureEvent=null;
  const captureMetaQueue=[];
  const seenCaptureRows=new WeakMap();
  let captureLogTimer=null, captureRenderTimer=null, captureLogPoller=null;
  let lastListScroll=0;
  let renderTimer=null,saveTimer=null,tooltipTimer=null,lastTooltipKey='',drag=null,dockDrag=null,resizeDrag=null,suppressDockClick=false,updatePending=false,navObserver=null;
  const buildRecord=()=>({prefs:state.prefs,pinned:state.pinned,history:state.history.slice(0,50),catches:state.catches.slice(0,200),shinyLog:state.shinyLog.slice(0,200),session:state.session,dailyLogs:state.dailyLogs,manualLogs:state.manualLogs,captureRarities:state.captureRarities,pos:state.pos,dockPos:state.dockPos,completePos:state.completePos,completeSize:state.completeSize,huntTarget:state.huntTarget,pokeTarget:state.pokeTarget});
  function flush(){
    if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
    try{chrome.storage.local.set({[STORE]:buildRecord()}).catch(()=>{});}catch{}
    try{sessionStorage.setItem(STORE+':hunt',JSON.stringify({kills:state.kills.slice(-1400),parts:state.parts,loot:state.loot,totalXp:state.totalXp,level:state.level}));}catch{}
  }
  function persist(){if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(flush,600);}
  const log=(type,msg)=>{state.feed.unshift({t:now(),type,msg:C.text(msg,140)});state.feed.length=Math.min(45,state.feed.length);};
  const formatTime=t=>t?new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
  const formatDate=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  function resetSession(at=now()){
    state.session=M.fresh(at);state.catches=[];state.shinyLog=[];state.shinyTracker.reset();
    state.kills=[];state.totalXp=null;state.level=null;state.parts={};state.loot={};state.feed=[];lastCaptureEvent=null;
  }
  function closeElapsed(at=now()){
    const result=M.rotate(state.session,at);
    if(!result.closed&&result.session===state.session)return;
    if(result.closed)state.dailyLogs=M.prune([result.closed,...state.dailyLogs],'daily',at);
    resetSession(at);
    state.activityExpanded=false;state.catchesExpanded=false;state.lootExpanded=false;state.shinyExpanded=false;
    persist();scheduleRender();
  }
  function saveManual(){
    const report=M.snapshot(state.session,now(),'manual');
    report.id+='-'+now().toString(16)+Math.random().toString(16).slice(2,10);
    state.manualLogs=M.prune([report,...state.manualLogs],'manual');persist();scheduleRender();
  }
  function logEntries(kind){return kind==='daily'?state.dailyLogs:state.manualLogs;}
  function logList(kind){const items=logEntries(kind);return `<div class="sd-log-group"><div class="sd-flex"><strong>${kind==='daily'?'◷ LOG Diário (24 horas)':'▣ LOG Manual'}</strong><span class="sd-pill">${items.length}/5</span></div>${items.length?items.map(item=>`<div class="sd-log-row"><div class="sd-grow"><b>${formatDate(item.startAt)}</b><small>${formatDate(item.endAt)} · ${F(item.summary.kills)} abates · ${F(item.summary.captures)} capturas${item.partial?' · Dados parciais':''}</small></div><button type="button" class="sd-ghost sd-xs" data-action="view-log" data-kind="${kind}" data-id="${E(item.id)}" title="Visualizar Community LOG">Visualizar</button><button type="button" class="sd-ghost sd-xs sd-delete" data-action="delete-log" data-kind="${kind}" data-id="${E(item.id)}" title="Excluir registro">×</button></div>`).join(''):'<p>Nenhum registro salvo.</p>'}</div>`;}
  function reportsUI(){return logList('daily')+logList('manual')+'<p class="sd-note">Os registros ficam salvos neste navegador. Cada LOG pode ser visualizado e exportado como arquivo JSON.</p>';}
  async function logViewer(kind,id){if(!['daily','manual'].includes(kind))return;const entry=logEntries(kind).find(x=>x.id===id);if(!entry)return;
    try{await chrome.storage.local.set({[STORE]:buildRecord()});chrome.runtime.sendMessage({action:'open-log',kind,id},()=>{void chrome.runtime.lastError;});}
    catch{toast('LOG indisponível','Não foi possível salvar o registro antes de abrir.');}
  }
  const status=()=>{
    if(state.socket==='open'&&state.wsMessages>0)return 'Conectado';
    if(state.socket==='open')return 'Socket aberto';
    if(state.socket==='closed')return 'Reconectando';
    if(state.bridge==='error')return 'Erro no leitor';
    if(state.socket==='created')return 'Conectando';
    return 'Aguardando jogo';
  };
  const stats=()=>{
    const s=state.session;
    return {attempts:s.attempts,catches:s.captures,wins:s.captures,rate:s.attempts?100*s.captures/s.attempts:0,shiny:s.shinyEncounters,shinyCaptures:s.shinyCaptures,xp:s.xp,kills:s.kills};
  };
  function audio(){if(!state.prefs.sound)return;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const start=ctx.currentTime;[660,990,1320].forEach((hz,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,start+i*.115);gain.gain.exponentialRampToValueAtTime(.06,start+i*.115+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+i*.115+.18);osc.connect(gain).connect(ctx.destination);osc.start(start+i*.115);osc.stop(start+i*.115+.2);});setTimeout(()=>ctx.close().catch(()=>{}),950);}catch{}}
  function toast(title,sub){if(!state.prefs.toasts||!alertBox)return;const el=document.createElement('div');el.className='sd-toast';const h=document.createElement('strong');h.textContent=C.text(title,70);const p=document.createElement('span');p.textContent=C.text(sub,120);el.append(h,p);alertBox.append(el);while(alertBox.children.length>3)alertBox.firstElementChild?.remove();setTimeout(()=>el.remove(),5000);}
  function onShiny(raw){
    if(!state.prefs.shiny)return;
    const current=C.normalizeShinyHistory([raw])[0];
    if(!current)return;
    const observation=state.shinyTracker.observe(current,now());
    if(!observation.isNew){
      // Resolve a previously unknown species without creating another record.
      let repaired=false;
      if(!/^(?:\d+|Pokémon #\d+)$/i.test(current.name)){
        const existing=state.shinyLog.find(item=>
          (item.speciesId&&current.speciesId&&item.speciesId===current.speciesId)||
          (item.position!=='?:?'&&item.position===current.position&&
           Math.abs(now()-Number(item.t))<10*60*1000)
        );
        if(existing&&/^(?:\d+|Pokémon #\d+)$/i.test(existing.name)){
          existing.name=current.name;
          existing.speciesId=existing.speciesId||current.speciesId;
          repaired=true;
        }
      }
      const updated=C.normalizeShinyHistory(state.shinyLog);
      if(repaired||JSON.stringify(updated)!==JSON.stringify(state.shinyLog)){
        state.shinyLog=updated;persist();scheduleRender();
      }
      return;
    }
    const updated=C.normalizeShinyHistory([current,...state.shinyLog]);
    if(updated.length<=state.shinyLog.length && state.shinyLog.length<200){
      state.shinyLog=updated;
      persist();
      return;
    }
    state.shinyLog=updated;
    M.addShiny(state.session,current);
    log('shiny','✨ '+current.name+' detectado');
    toast('✨ Shiny detectado!',current.name+' • '+formatTime(current.t));
    audio();persist();
  }
  function onKill(k){
    const prev=state.kills.at(-1);
    if(prev&&Math.abs(prev.t-k.t)<500&&prev.totalXp!==null&&k.totalXp!==null&&prev.totalXp===k.totalXp)return;
    M.addKill(state.session,k);
    state.kills.push(k);state.kills=state.kills.slice(-1400);
    if(k.totalXp!==null)state.totalXp=k.totalXp;if(k.level!==null)state.level=k.level;
    for(const [key,v] of Object.entries(k.parts))state.parts[key]=(state.parts[key]||0)+v;
    for(const item of k.loot)state.loot[item.name]=(state.loot[item.name]||0)+item.qty;
    if(state.session.kills%30===0)persist();
  }
  function onCaptureMetadata(raw){
    const meta=C.captureDetail(raw);
    if(meta.quality==null&&meta.ivTotal==null&&meta.rarity==null&&meta.power==null)return false;
    const name=C.normalizeName(raw.speciesName||raw.pokemonName||raw.name||C.speciesNameById(meta.speciesId)||'');
    const id=meta.pokemonId||raw.pokemonId||null;
    const candidate={name,pokemonId:id,speciesId:meta.speciesId,clock:raw.clock||null};
    const fresh=state.catches.filter(c=>now()-c.t<120000&&(!meta.speciesId||!c.speciesId||Number(c.speciesId)===meta.speciesId));
    const target=L.chooseCapture(candidate,fresh,now())||L.chooseCapture(candidate,state.catches,now());
    if(!target){
      captureMetaQueue.push({raw,receivedAt:now()});
      captureMetaQueue.splice(0,Math.max(0,captureMetaQueue.length-30));
      return false;
    }
    for(const key of ['quality','ivTotal','ivMax','rarity','power','pokemonId','speciesId','spriteUrl']){
      if(meta[key]!=null&&(target[key]==null||key==='ivMax'))target[key]=meta[key];
    }
    target.rarity=M.rarity(target.rarity,target.quality);
    target.metadataMatched=true;
    M.enrichCapture(state.session,target);
    state.catches=state.session.recentCaptures;
    persist();scheduleRender();return true;
  }
  function applyCaptureLogMatch({row,meta,capture}){
    if(!row||!meta||!capture)return;
    const fingerprint=[meta.name,meta.ivTotal,meta.quality,meta.rarity,meta.clock,meta.spriteUrl].join('|');
    if(seenCaptureRows.get(row)===fingerprint&&capture.metadataMatched)return;
    let changed=false;
    for(const key of ['quality','ivTotal','ivMax','rarity','pokemonId','speciesId','spriteUrl']){
      if(meta[key]!=null&&(capture[key]==null||key==='ivMax')){
        capture[key]=meta[key];changed=true;
      }
    }
    const normalized=M.rarity(capture.rarity,capture.quality);
    if(capture.rarity!==normalized){capture.rarity=normalized;changed=true;}
    if(!changed&&!capture.metadataMatched)return;
    capture.metadataMatched=true;
    seenCaptureRows.set(row,fingerprint);
    M.enrichCapture(state.session,capture);
    if(changed){persist();scheduleRender();}
  }
  function inspectCaptureLog(){
    captureLogTimer=null;
    const rows=document.querySelectorAll('.clog-window .clog-row');
    if(!rows.length||!state.catches.length)return;
    for(const match of L.reconcileRows(rows,state.catches,now()))applyCaptureLogMatch(match);
  }
  function scheduleCaptureLog(){
    if(captureLogTimer)return;
    captureLogTimer=setTimeout(inspectCaptureLog,150);
  }
  function applyPendingCaptureMetadata(){
    for(let i=captureMetaQueue.length-1;i>=0;i--){
      const data=captureMetaQueue[i];captureMetaQueue.splice(i,1);
      if(now()-data.receivedAt<20000)onCaptureMetadata(data.raw);
    }
  }
  function onCaptureApiRows(rows){
    const matches=L.reconcileApiRows(rows,state.catches,now());
    let changed=false;
    for(const {meta,capture} of matches){
      const detail=C.captureDetail(meta);
      if(detail.quality==null&&detail.ivTotal==null&&detail.rarity==null)continue;
      for(const key of ['quality','ivTotal','ivMax','rarity','pokemonId','speciesId','spriteUrl']){
        if(detail[key]!=null&&(capture[key]==null||key==='ivMax')){
          capture[key]=detail[key];changed=true;
        }
      }
      const r=M.rarity(capture.rarity,capture.quality);
      if(capture.rarity!==r){capture.rarity=r;changed=true;}
      if(!capture.metadataMatched){capture.metadataMatched=true;changed=true;}
      M.enrichCapture(state.session,capture);
    }
    if(changed){state.catches=state.session.recentCaptures;persist();scheduleRender();}
  }
  function requestCaptureLog(){
    if(!state.catches.some(c=>c.t>=now()-M.DAY&&(c.quality==null||c.ivTotal==null||!M.rarity(c.rarity,c.quality))))return;
    window.postMessage({channel:CH,type:'capture-log-request'},location.origin);
  }
  function onCapture(c){
    const prev=lastCaptureEvent;
    if(prev&&prev.name===c.name&&prev.ball===c.ball&&prev.success===c.success&&Math.abs(prev.t-c.t)<230)return;
    lastCaptureEvent=c;
    M.addCapture(state.session,c);
    if(c.success){state.catches=state.session.recentCaptures;applyPendingCaptureMetadata();scheduleCaptureLog();setTimeout(scheduleCaptureLog,450);setTimeout(scheduleCaptureLog,1600);setTimeout(requestCaptureLog,1700);setTimeout(requestCaptureLog,12000);setTimeout(requestCaptureLog,70000);}
    if(c.success)log('capture',(c.shiny?'✦ Shiny capturado: ':'✓ Capturado: ')+c.name+' • '+c.ball);
    persist();
    if(c.success){
      clearTimeout(captureRenderTimer);
      captureRenderTimer=setTimeout(()=>{captureRenderTimer=null;if(now()-lastListScroll>750 && state.open&&!state.min&&['captures','stream'].includes(state.tab))render();else scheduleRender();},160);
    }else scheduleRender();
  }
  function acceptPacket(packet){
    if(!packet||typeof packet!=='object')return;
    closeElapsed();state.lastPacket=now();
    try{for(const s of C.shinyFrom(packet))onShiny(s);}catch{}
    try{for(const c of C.captureFrom(packet))onCapture(c);}catch{}
    try{for(const k of C.killFrom(packet))onKill(k);}catch{}
    scheduleRender();
  }
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin)return;
    const m=event.data;
    if(!m||m.channel!==CH||!['bridge','heartbeat','socket','packet','capture-meta','capture-log-data'].includes(m.type))return;
    const p=m.payload||{};
    if(m.type==='bridge')state.bridge=p.state==='ready'?'Ativo':'error';
    if(m.type==='socket')state.socket=['created','open','closed','error'].includes(p.state)?p.state:'aguardando';
    if(typeof p.messages==='number')state.wsMessages=p.messages;
    if(m.type==='packet')acceptPacket(p.data);
    else if(m.type==='capture-meta'){for(const meta of (Array.isArray(p.pokemon)?p.pokemon:[]).slice(0,12))onCaptureMetadata(meta);}
    else if(m.type==='capture-log-data'){onCaptureApiRows(Array.isArray(p.rows)?p.rows:[]);}
    else scheduleRender();
  });
  function scheduleRender(){if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;if(now()-lastListScroll<850){scheduleRender();return;}render();},380);}
  function storePokemon(p){
    const sig=[p.name,p.level,p.quality,...Object.values(p.stats)].join(':');
    if(sig===lastTooltipKey&&state.pokemon&&[state.pokemon.name,state.pokemon.level,state.pokemon.quality,...Object.values(state.pokemon.stats)].join(':')===sig)return;
    lastTooltipKey=sig;
    state.pokemon=p;
    state.history=state.history.filter(v=>[v.name,v.level,v.quality,...Object.values(v.stats)].join(':')!==sig);
    state.history.unshift(p);state.history.length=Math.min(50,state.history.length);
    loadBase(p.name);
    if(state.prefs.autoPokemon&&state.prefs.tabVisible.pokemon!==false&&(state.prefs.dexMode==='complete'||state.prefs.floatingButton)){state.tab='pokemon';state.open=true;state.min=false;}
    persist();scheduleRender();
  }
  // Read visible Pokémon tooltips with structured and text-only fallbacks.
  const POKE_TOOLTIP_SELECTOR='.inv-tip,.poke-tip,.pk-tip,[role="tooltip"],[class*="-tip"],[class*="tip-"],[class*="tooltip"]';
  const POKE_TOOLTIP_ROOT='.inv-tip,.poke-tip,.pk-tip,[role="tooltip"],[class*="pokemon-tooltip"],[class*="poke-tooltip"]';
  function tooltipRoot(el){
    if(!(el instanceof Element))return null;
    return el.closest(POKE_TOOLTIP_ROOT)||el;
  }
  function readPokemonTooltip(el){
    const root=tooltipRoot(el);
    if(!root||!root.isConnected||root.closest('#community-dex-root'))return false;
    const bounds=root.getBoundingClientRect();
    if(bounds.width===0||bounds.height===0)return false;
    const style=getComputedStyle(root);
    if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;
    const name=root.querySelector('.inv-tip-name,.poke-tip-name,.pk-tip-name,[class*="tip-name"]')?.textContent?.trim()||'';
    const types=root.querySelector('.inv-tip-types,.poke-tip-types,[class*="tip-types"]')?.textContent?.trim()||'';
    const stats=root.querySelector('.inv-tip-poke,.poke-tip-poke,.pk-tip-poke,[class*="tip-poke"]');
    // Try the visible text first, then textContent (which can omit ALL separators).
    const candidates=[stats?.innerText,stats?.textContent,root.innerText,root.textContent];
    for(const raw of candidates){
      if(typeof raw!=='string'||raw.length<12||raw.length>5000)continue;
      const p=C.parseTooltip(raw,name,types);
      if(p){storePokemon(p);return true;}
    }
    return false;
  }
  function inspectTooltips(){
    tooltipTimer=null;
    if(!state.prefs.enabled)return false;
    const seen=new Set();
    for(const el of document.querySelectorAll(POKE_TOOLTIP_SELECTOR)){
      const root=tooltipRoot(el);
      if(!root||seen.has(root))continue;
      seen.add(root);
      if(seen.size>100)break;
      if(readPokemonTooltip(root))return true;
    }
    return false;
  }
  function scheduleTooltip(delay=75){
    if(tooltipTimer)clearTimeout(tooltipTimer);
    tooltipTimer=setTimeout(inspectTooltips,delay);
  }
  function checkAddedTooltip(node){
    if(!(node instanceof Element)||node.closest('#community-dex-root'))return false;
    if(node.matches(POKE_TOOLTIP_SELECTOR)&&readPokemonTooltip(node))return true;
    // When React inserts an entire tooltip at once, inspect it immediately:
    // a delayed read may miss the tooltip after the mouse moves.
    const children=node.querySelectorAll(POKE_TOOLTIP_SELECTOR);
    for(const el of Array.from(children).slice(0,24))if(readPokemonTooltip(el))return true;
    return false;
  }
  function initObserver(){
    const setup=()=>{
      if(!document.body){document.addEventListener('DOMContentLoaded',setup,{once:true});return;}
      const hovered=ev=>{
        const target=ev.target;
        if(target?.closest?.('#community-dex-root'))return;
        if(target instanceof Element){
          const ancestor=target.closest(POKE_TOOLTIP_SELECTOR);
          if(ancestor&&readPokemonTooltip(ancestor))return;
        }
        scheduleTooltip(45);
      };
      document.addEventListener('pointerover',hovered,true);
      scheduleCaptureLog();
      captureLogPoller=setInterval(()=>{
        if(document.querySelector('.clog-window .clog-row')&&state.catches.some(c=>c.quality==null||c.ivTotal==null))scheduleCaptureLog();
      },2500);
      document.addEventListener('mouseover',hovered,true);
      const ob=new MutationObserver(muts=>{
        let needsScan=false;
        for(const m of muts){
          const parent=m.target?.nodeType===1?m.target:m.target?.parentElement;
          if(parent?.closest?.('#community-dex-root'))continue;
          if(parent?.closest?.('.clog-window')||Array.from(m.addedNodes||[]).some(node=>node.nodeType===1&&(node.matches?.('.clog-window,.clog-list,.clog-row')||node.querySelector?.('.clog-window,.clog-row'))))scheduleCaptureLog();
          if(m.type==='childList'){
            for(const node of m.addedNodes){
              if(checkAddedTooltip(node))return;
              if(node.nodeType===3&&node.parentElement?.closest?.(POKE_TOOLTIP_SELECTOR))needsScan=true;
            }
            if(m.addedNodes.length)needsScan=true;
          }else if(m.type==='characterData'){
            if(parent?.closest?.(POKE_TOOLTIP_SELECTOR))needsScan=true;
          }else if(m.type==='attributes'){
            if(parent?.matches?.(POKE_TOOLTIP_SELECTOR)||parent?.closest?.(POKE_TOOLTIP_SELECTOR))needsScan=true;
          }
        }
        if(needsScan)scheduleTooltip(55);
      });
      ob.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']});
      inspectTooltips();
    };setup();
  }
  function loadBase(name){
    const slug=C.normalizeName(name);
    if(!slug||state.base[slug]||state.basePending.has(slug))return;
    state.basePending.add(slug);
    chrome.runtime.sendMessage({action:'base-stats',species:slug},response=>{
      state.basePending.delete(slug);
      if(chrome.runtime.lastError){state.baseErrors[slug]='Serviço indisponível';scheduleRender();return;}
      if(response?.base){state.base[slug]=response;delete state.baseErrors[slug];}
      else state.baseErrors[slug]=response?.error||'Base não encontrada';
      scheduleRender();
    });
  }
  function card(label,value,foot,style='',icon='✧'){
    return `<div class="sd-metric ${style}"><span class="sd-metric-icon" aria-hidden="true">${icon}</span><span class="sd-metric-name">${E(label)}</span><strong>${E(value)}</strong><small>${E(foot)}</small></div>`;
  }
  const empty=(msg,icon='◇')=>`<div class="sd-empty"><b>${icon}</b><p>${E(msg)}</p></div>`;
  function overview(){
    const t=stats(),rates=C.huntRates(state.kills),activity=state.feed.slice(0,state.activityExpanded?45:5);
    const activityUI=`<div data-scroll-id="activity" class="sd-list-area ${state.activityExpanded?'sd-list-scroll':''}">${activity.length?activity.map(eventHtml).join(''):empty('A atividade aparece aqui conforme você joga.','⌁')}</div>${buttonMore('show-more-activity',state.activityExpanded,state.feed.length,5)}`;
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">SEU PAINEL</span><h3>Visão geral <span class="sd-title-emoji">✧</span></h3></div><div class="sd-overview-actions"><button type="button" class="sd-ghost sd-xs sd-save-manual" data-action="save-manual" title="Salvar o resumo atual sem zerar os contadores">▣ Salvar LOG</button><button type="button" class="sd-reset-overview" data-action="reset-overview">↻ Zerar estatísticas</button></div></div>
    ${sectionShown('overviewMetrics')?`<div class="sd-metrics">${card('Shinies encontrados',F(t.shiny),'Encontros registrados','sd-accent','✦')}${card('Capturas',F(t.catches),F(t.shinyCaptures)+' Shinies capturados','sd-purple','◈')}${card('Abates na sessão',F(t.kills),S(t.xp)+' XP','sd-blue','⚔')}${card('Ritmo da hunt',rates.xpHour===null?'—':S(rates.xpHour),'XP por hora ativa','sd-greenish','⚡')}</div>`:''}
    <a class="sd-hub-link" href="https://stigalzera.com/" target="_blank" rel="noopener noreferrer"><span class="sd-hub-emblem">✦</span><span class="sd-grow"><b>Community Hub</b><small>stigalzera.com · Entre na comunidade</small></span><span class="sd-hub-arrow">↗</span></a>
    ${sectionShown('overviewLogs')?expandable('overviewLogs','Histórico & Logs','▣',reportsUI(),{count:'LOG Diário e LOG Manual · 5 de cada'}):''}
    ${sectionShown('overviewActivity')?expandable('overviewActivity','Atividade recente','⌁',activityUI,{count:`${state.feed.length} eventos · até 45 registros`}):''}
    </section>`;
  }
  function pokemonCard(p,withPin=true){
    const slug=C.normalizeName(p.name),b=state.base[slug],analysis=b?.base?C.estimateIV(p,b.base,state.prefs.ivMax):null;
    const types=(p.types?.length?p.types:b?.types)||[];
    const matrix=C.typeMatrix(types);
    const official=p.ivTotal!==null?`<span class="sd-pill sd-green">✓ IV total: ${F(p.ivTotal)}${p.ivMax?'/'+F(p.ivMax):''}</span>`:'';
    const img=b?.image?`<img class="sd-artwork" src="${E(b.image)}" alt="${E(p.name)}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="sd-pokemon-fallback">◉</span>';
    const chips=(xs,cls)=>xs.length?xs.map(a=>`<span class="${cls}">${E(C.TYPE_PT[a.type]||a.type)} <b>${a.mult}×</b></span>`).join(''):'<span class="sd-muted">—</span>';
    const ivHtml=analysis?`<div class="sd-power"><strong>${F(analysis.potential,1)}%</strong><span>Potencial estimado <small>(${E(analysis.confidence)} confiança · ${analysis.count}/6 atributos)</small></span></div>
      <div class="sd-stats">${Object.entries(C.STAT_NAMES).map(([key,label])=>`<div class="sd-stat"><div><span>${E(label)}</span><b>${analysis.ivs[key]===null?'—':F(analysis.ivs[key])+'/'+state.prefs.ivMax}</b></div><div class="sd-track"><i style="width:${Math.max(0,Math.min(100,100*(analysis.ivs[key]??0)/state.prefs.ivMax))}%"></i></div></div>`).join('')}</div>
      <small class="sd-note">Valores estimados a partir do nível, qualidade e atributos informados.</small>`:
      `<div class="sd-softline">${state.basePending.has(slug)?'⏳ Carregando atributos da espécie…':state.baseErrors[slug]?'Não foi possível completar a análise: '+E(state.baseErrors[slug]):'Aguardando atributos da espécie…'}</div>`;
    return `<article class="sd-pokemon-card"><div class="sd-poke-hero"><div class="sd-art-holder">${img}</div><div class="sd-grow"><div class="sd-overline">✦ FICHA DO POKÉMON</div><h3>${E(p.name)}</h3><div class="sd-sub">Lv ${F(p.level)} <span>•</span> ${E(C.qualityLabel(p.quality))} ×${F(p.quality,2)}</div><div class="sd-type-row">${types.map(t=>`<span class="sd-type" data-type="${E(C.typeCode(t)||'normal')}">${E(C.TYPE_PT[C.typeCode(t)]||t)}</span>`).join('')}</div></div></div>
    <div class="sd-pokemon-actions">${official}${p.power!==null&&p.power!==undefined?`<span class="sd-pill sd-gold">⚡ Poder: ${F(p.power)}</span>`:''}<button type="button" class="sd-ghost sd-xs sd-copy-scanned" data-action="copy-scanned" title="Copiar esta ficha em texto editável">▣ Copiar</button>${withPin?`<button class="sd-ghost sd-xs" data-action="pin">${state.pinned?.name===p.name?'✓ Fixado':'♧ Comparar'}</button>`:''}</div>
    ${ivHtml}
    ${sectionShown('pokemonStats')?`<div class="sd-miniheading">✧ Atributos atuais</div><div class="sd-valuegrid">${Object.entries(C.STAT_NAMES).map(([key,label])=>`<div><small>${E(label)}</small><b>${F(p.stats?.[key])}</b></div>`).join('')}</div>`:''}
    ${sectionShown('pokemonTypes')?expandable('pokemonTypes','Fraquezas, resistências e imunidades','🛡',`<div class="sd-miniheading">⚔ Fraquezas ${matrix.weak.length?'':'· sem dados'}</div><div class="sd-tagrow">${chips(matrix.weak,'sd-weak')}</div><div class="sd-miniheading">🛡 Resistências</div><div class="sd-tagrow">${chips(matrix.resist,'sd-resist')}</div><div class="sd-miniheading">✧ Imunidades</div><div class="sd-tagrow">${chips(matrix.immune,'sd-immune')}</div>`,{count:'Análise de efetividade dos tipos'}):''}</article>`;
  }
  function pokemon(){
    const p=state.pokemon;
    let compare='';
    if(state.pinned&&p){const diff=['hp','atk','def','spa','spd','spe'].map(k=>{const a=p.stats?.[k],b=state.pinned.stats?.[k];return `<div class="sd-compare"><span>${E(C.STAT_NAMES[k])}</span><b>${F(b)}</b><b>${F(a)} <small class="${a>b?'sd-positive':a<b?'sd-negative':''}">${a!==null&&b!==null?(a-b>0?'+':'')+F(a-b):''}</small></b></div>`;}).join('');compare=`<div class="sd-panelcard"><div class="sd-section-head"><h3>Comparação de exemplares</h3><button class="sd-ghost sd-xs" data-action="unpin">Remover</button></div><div class="sd-compare"><b>Atributo</b><b>${E(state.pinned.name)}</b><b>Atual</b></div>${diff}</div>`;}
    return `<section class="sd-stack"><div class="sd-section-head"><h3>Pokédex inteligente</h3><span class="sd-pill">Ao passar o mouse</span></div>
      ${p?pokemonCard(p):empty('Passe o mouse sobre um Pokémon no inventário para ler a ficha.','◉')}
      ${compare}${sectionShown('pokemonManual')?expandable('pokemonManual','Leitura manual','✎',`<p>Edite uma ficha abaixo ou cole os dados de um Pokémon.</p><textarea id="sd-tooltip-input" rows="6" spellcheck="false" placeholder="Nome do Pokémon&#10;Lv 100 · Quality ×1.80&#10;HP 350 · Atk 240 · Def 210">${E(state.manualText)}</textarea><div class="sd-manual-actions"><button type="button" class="sd-btn" data-action="parse-manual">◉ Analisar ficha</button><button type="button" class="sd-ghost sd-copy-btn" data-action="copy-template" title="Copiar modelo de ficha e preencher o campo quando vazio">▣ Copiar modelo</button></div>`,{count:'Toque para inserir ou analisar uma ficha'}):''}
      ${sectionShown('pokemonHistory')?`<div class="sd-panelcard"><div class="sd-section-head"><h4>◷ Histórico recente</h4><small>${state.history.length} fichas</small></div>
      <div data-scroll-id="pokemon-history" class="sd-list-area ${state.historyExpanded?'sd-list-scroll':''}">${state.history.length?state.history.slice(0,state.historyExpanded?50:5).map((h,i)=>`<button class="sd-history" data-action="load-history" data-index="${i}"><span>◉</span><b>${E(h.name)}</b><small>Lv ${F(h.level)} · ×${F(h.quality,2)}</small></button>`).join(''):empty('Ainda não existem análises salvas.')}</div>${buttonMore('show-more-history',state.historyExpanded,state.history.length,5)}</div>`:''}</section>`;
  }
  function hunt(){const r=C.huntRates(state.kills),t=stats(),loot=Object.entries(state.loot).sort((a,b)=>b[1]-a[1]).slice(0,50);
    const sampled=M.currentBonuses(state.kills,now());
    const data=sampled.filter(p=>p.rate>0).sort((a,b)=>b.rate-a.rate);
    const names=data.map(({key,rate,samples})=>{
      const label=XP_LABELS[key]||XP_LABELS[key.toLowerCase()]||key.replace(/([a-z])([A-Z])/g,'$1 $2');
      return `<div class="sd-xp-row"><div class="sd-flex"><span>${E(label)}</span><b>+${F(rate,Number.isInteger(rate)?0:1)}%</b></div><div class="sd-track"><i style="width:${Math.min(100,Math.max(0,rate))}%"></i></div></div>`;
    }).join('');
    const composition=sectionShown('huntComposition')?expandable('huntComposition','Composição da experiência','◈',data.length?`${names}<p class="sd-note">Bônus sobre a XP base observados nos abates mais recentes. Quando um benefício muda, os valores se ajustam sem misturar toda a sessão.</p>`:empty('Aguardando os bônus dos próximos abates.'),{count:'Bônus atuais sobre a XP base'}):'';
    const calculator=sectionShown('huntCalculator')?expandable('huntCalculator','Calculadora de XP','⌁',`<p>Planeje sua evolução por nível.</p><div class="sd-fields"><label>Nível atual<input id="sd-xp-from" type="number" min="1" max="9999" value="${Math.floor(state.level||1)}"></label><label>Nível alvo<input id="sd-xp-to" type="number" min="2" max="10000" value="${Math.floor(state.huntTarget)}"></label></div><button class="sd-btn" data-action="calculate-xp">⚡ Calcular XP</button><div id="sd-xp-result" class="sd-softline">Informe os níveis para calcular.</div>`):'';
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">SUA EVOLUÇÃO</span><h3>⚡ Tracker de hunt</h3></div><button class="sd-ghost sd-xs" data-action="reset-hunt">↻ Zerar</button></div>
    <div class="sd-metrics">${card('XP da sessão',S(t.xp),'Experiência obtida','sd-accent','✦')}${card('XP por hora',r.xpHour===null?'—':S(r.xpHour),'Janela de hunt ativa','sd-blue','⚡')}${card('Abates / hora',r.killsHour===null?'—':F(r.killsHour),'Ritmo de combate','sd-purple','⚔')}${card('Abates totais',F(t.kills),'Sessão atual','sd-greenish','◎')}</div>
    ${composition}
    ${sectionShown('huntLoot')?`<div class="sd-panelcard"><div class="sd-flex"><h4>🎒 Loot da sessão</h4><span class="sd-pill">${loot.length} itens</span></div><div data-scroll-id="loot" class="sd-list-area ${state.lootExpanded?'sd-list-scroll':''}">${loot.length?loot.slice(0,state.lootExpanded?50:5).map(([n,q])=>`<div class="sd-split"><span>${E(n)}</span><b>×${F(q)}</b></div>`).join(''):empty('Nenhum loot contabilizado.')}</div>${buttonMore('show-more-loot',state.lootExpanded,loot.length,5)}</div>`:''}
    ${calculator}</section>`;
  }
  function bestCaptureCard(){
    const best=state.session.bestCapture;
    if(!best)return card('Melhor captura','—','Aguardando qualidade, IV ou Poder','sd-accent','♛');
    const rare=M.rarity(best.rarity,best.quality)||'Raridade pendente';
    const quality=best.quality!=null?' ×'+F(best.quality,2):'';
    const iv=best.ivTotal!=null?' · IV '+F(best.ivTotal)+'/192':'';
    const power=best.power!=null?' · Poder '+F(best.power):'';
    return card('Melhor captura',best.name,rare+quality+iv+power,'sd-accent sd-best-capture','♛');
  }
  function captureHistory(stream=false){
    const selected=state.captureTab;
    const filtered=M.sortCaptures(M.filterCaptures(state.catches,selected,state.captureRarities),state.captureSort);
    const expanded=stream?state.streamCatchesExpanded:state.catchesExpanded;
    const recent=filtered.slice(0,expanded?200:5);
    const filters=`<div class="sd-capture-controls"><label><span>Exibir</span><select data-capture-kind aria-label="Tipo de captura">${[['all','Todos'],['normal','Normais'],['shiny','Shiny']].map(([key,name])=>`<option value="${key}" ${selected===key?'selected':''}>${name}</option>`).join('')}</select></label><label><span>Ordenar</span><select data-capture-sort aria-label="Ordenar capturas">${[['recent','Mais recente'],['iv','Maior IV'],['rarity','Mais raro']].map(([key,name])=>`<option value="${key}" ${state.captureSort===key?'selected':''}>${name}</option>`).join('')}</select></label></div>
      <div class="sd-rarity-dropdown"><button type="button" class="sd-rarity-trigger" data-action="toggle-rarity-dropdown" aria-expanded="${state.rarityDropdownOpen}" aria-label="Selecionar raridades">◇ Raridades <small>${state.captureRarities.length===M.RARITIES.length+1?'Todas':state.captureRarities.length+' selecionadas'}</small> <span>${state.rarityDropdownOpen?'⌃':'⌄'}</span></button>${state.rarityDropdownOpen?`<div class="sd-rarity-menu"><div class="sd-rarity-tools"><button type="button" data-action="all-rarities">Selecionar todas</button><button type="button" data-action="no-rarities">Limpar</button></div><div class="sd-rarity-options">${[...M.RARITIES,'Não informada'].map(key=>`<label class="sd-rarity-option"><input type="checkbox" data-rarity="${E(key)}" ${state.captureRarities.includes(key)?'checked':''}><span>${E(key)}</span></label>`).join('')}</div></div>`:''}</div>`;
    const filtersExpanded=stream?state.streamFiltersExpanded:state.capturesFiltersExpanded;
    const controls=`<button type="button" class="sd-stream-filter-toggle" data-action="${stream?'toggle-stream-filters':'toggle-capture-filters'}" aria-expanded="${filtersExpanded}">⌕ Filtros <span>${filtersExpanded?'⌃':'⌄'}</span></button>${filtersExpanded?filters:''}`;
    const scrollId=stream?'stream-captures':'captures';
    const showAction=stream?'show-more-stream-catches':'show-more-catches';
    const note=stream?'':'<p class="sd-note">Para sincronizar raridade e IV de capturas anteriores, abra o Log de Capturas do jogo. A Dex lê os dados exibidos e os associa ao histórico.</p>';
    return `<div class="sd-panelcard sd-capture-history ${stream?'sd-stream-history':''}"><div class="sd-section-head"><h4>⌁ Últimas capturas</h4><span class="sd-pill">até 200 sucessos</span></div>${controls}<div data-scroll-id="${scrollId}" class="sd-list-area ${expanded?'sd-list-scroll':''}">${recent.length?recent.map(captureHtml).join(''):empty('Nenhuma captura encontrada com esses filtros.','◈')}</div>${buttonMore(showAction,expanded,filtered.length,5)}${note}</div>`;
  }
  function captures(){
    const t=stats(),groups=state.session.balls||{};
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">SEUS RESULTADOS</span><h3>◈ Analisador de capturas</h3></div><button class="sd-ghost sd-xs" data-action="export-catches">↓ CSV</button></div>
    <div class="sd-metrics">${card('Capturas',F(t.catches),'Sucessos nas últimas 24h','sd-greenish','✓')}${card('Capturas / hora',F(t.catches/Math.max(1/60,(now()-state.session.startAt)/3600000),1),'Média desta sessão','sd-blue','⚡')}${card('Taxa de captura',t.attempts?F(t.rate,1)+'%':'—','Sucessos / tentativas','sd-purple','◎')}${bestCaptureCard()}</div>
    ${sectionShown('capturesBalls')?expandable('capturesBalls','Resultados por Poké Bola','◉',`<div class="sd-section-head sd-section-actions"><small>Distribuição por Poké Bola</small><button class="sd-ghost sd-xs" data-action="clear-catches">Limpar</button></div>${Object.keys(groups).length?Object.entries(groups).sort((a,b)=>b[1].tries-a[1].tries).map(([name,g])=>`<div class="sd-ball"><div class="sd-flex"><b>${E(name)}</b><small>${F(g.wins)}/${F(g.tries)} · ${F(g.wins/g.tries*100,1)}%</small></div><div class="sd-track"><i style="width:${g.wins/g.tries*100}%"></i></div></div>`).join(''):empty('Aguardando resultados de capturas.')}`,{count:'Estatísticas por tipo de Poké Bola'}):''}
    ${sectionShown('capturesRecent')?captureHistory():''}</section>`;
  }
  function stream(){
    const t=stats(),rates=C.huntRates(state.kills);
    const rateKills=rates.killsHour===null?'—':F(rates.killsHour);
    const rateXP=rates.xpHour===null?'—':S(rates.xpHour);
    const metrics=[
      card('Abates / hora',rateKills,'Ritmo de combate','sd-purple','↗'),
      card('Abates totais',F(t.kills),'Sessão atual','sd-greenish','◎'),
      card('Capturas',F(t.catches),'Sucessos da sessão','sd-greenish','◈'),
      card('Shinies encontrados',F(t.shiny),'Encontros registrados','sd-accent','✦'),
      card('Ritmo da Hunt',rateXP,'XP por hora ativa','sd-blue','⚡'),
      card('XP da sessão',S(t.xp),'Experiência total','sd-purple','◉')
    ];
    return `<section class="sd-stack sd-stream-view"><div class="sd-stream-title"><div><span class="sd-eyebrow">SEU PAINEL DE STREAM</span><h3>📹 Stream Geral</h3></div><span class="sd-pill sd-gold">24H</span></div>${sectionShown('streamMetrics')?`<div class="sd-stream-metrics">${metrics.join('')}</div>`:''}${sectionShown('streamRecent')?captureHistory(true):''}</section>`;
  }
  function shiny(){return `<section class="sd-stack"><div class="sd-section-head"><h3>Radar de Shiny</h3><span class="sd-pill sd-gold">✦ Monitoramento</span></div>
     <div class="sd-shiny-hero"><div>✦</div><strong>${F(state.session.shinyEncounters)}</strong><span>avistamentos registrados</span></div>
     ${sectionShown('shinyDetector')?expandable('shinyDetector','Detector e alerta sonoro','✦',`<div class="sd-flex"><div><h4>Detector de Shinies</h4><p>Observa os eventos recebidos do mapa.</p></div><label class="sd-toggle"><input type="checkbox" data-pref="shiny" ${state.prefs.shiny?'checked':''}><span></span></label></div><div class="sd-flex sd-margin"><div><h4>Alerta sonoro original</h4><p>Som sintetizado localmente, sem arquivos externos.</p></div><label class="sd-toggle"><input type="checkbox" data-pref="sound" ${state.prefs.sound?'checked':''}><span></span></label></div>`,{count:'Configurações do radar Shiny'}):''}
     ${sectionShown('shinyHistory')?`<div class="sd-section-head"><h3>Histórico de encontros</h3><button class="sd-ghost sd-xs" data-action="clear-shiny">Limpar histórico</button></div>
     <div data-scroll-id="shinies" class="sd-list-area ${state.shinyExpanded?'sd-list-scroll':''}">${state.shinyLog.length?state.shinyLog.slice(0,state.shinyExpanded?50:5).map(s=>`<div class="sd-event sd-shinyevent"><span class="sd-event-icon">✦</span><span><b>${E(s.name)}</b><small> · ${E(s.position)}</small></span><time>${formatDate(s.t)}</time></div>`).join(''):empty('Nenhum Shiny visto desde a instalação.','✦')}</div>${buttonMore('show-more-shinies',state.shinyExpanded,Math.min(state.shinyLog.length,50),5)}`:''}
    </section>`;}
  const INSTALLED_VERSION=chrome.runtime.getManifest().version;
  const compareVersions=(a,b)=>{
    const left=String(a||'').replace(/^v/i,'').split('.').map(Number);
    const right=String(b||'').replace(/^v/i,'').split('.').map(Number);
    for(let index=0;index<Math.max(left.length,right.length,3);index++){
      const diff=(left[index]||0)-(right[index]||0);
      if(diff)return Math.sign(diff);
    }
    return 0;
  };
  function updatePanel(){
    const info=state.update;
    const newer=info.status==='ok'&&compareVersions(info.version,INSTALLED_VERSION)>0;
    const ahead=info.status==='ok'&&compareVersions(info.version,INSTALLED_VERSION)<0;
    const pill=info.status==='checking'?'<span class="sd-pill">Consultando…</span>':newer?'<span class="sd-pill sd-gold">✦ Nova versão</span>':ahead?`<span class="sd-pill sd-green">v${E(INSTALLED_VERSION)}</span>`:info.status==='ok'?'<span class="sd-pill sd-green">✓ Atualizado</span>':'<span class="sd-pill">GitHub</span>';
    let details='<p>Consulte as versões oficiais publicadas no GitHub.</p>';
    if(info.status==='checking')details='<p>Procurando a última versão publicada…</p>';
    if(info.status==='error')details=`<p class="sd-update-error">${E(info.message||'Não foi possível verificar agora.')}</p>`;
    if(info.status==='ok')details=newer?`<p>Versão <b>${E(info.version)}</b> disponível. Veja as novidades e baixe o pacote oficial.</p>`:ahead?`<p>Você está usando a v${E(INSTALLED_VERSION)}, mais nova que o último release público (${E(info.version)}).</p>`:`<p>Você está na versão mais recente publicada (${E(info.version)}).</p>`;
    return `<div class="sd-panelcard sd-update-card"><div class="sd-card-heading"><span class="sd-section-icon">↻</span><div class="sd-grow"><h4>Atualizações</h4><p>Versão instalada: <b>v${E(INSTALLED_VERSION)}</b></p></div>${pill}</div>
      ${details}
      <div class="sd-update-actions"><button type="button" class="sd-btn" data-action="check-updates" ${info.status==='checking'?'disabled':''}>↻ Verificar agora</button>${newer&&info.downloadUrl?'<button type="button" class="sd-ghost" data-action="download-update">↓ Baixar ZIP</button>':''}<button type="button" class="sd-ghost" data-action="open-release">↗ GitHub</button></div>
      ${toggle('autoUpdateCheck','Verificar automaticamente','Consulta novas versões ao abrir o jogo e periodicamente.')}
      <p class="sd-update-note">Instalação por pasta: para aplicar uma nova versão, substitua os arquivos e recarregue a extensão em chrome://extensions. O navegador não instala ZIPs do GitHub automaticamente.</p></div>`;
  }
  function checkUpdates(force=false){
    if(updatePending)return;
    updatePending=true;
    state.update={...state.update,status:'checking',message:''};
    if(state.tab==='settings')scheduleRender();
    try{
      chrome.runtime.sendMessage({action:'check-update',force},response=>{
        updatePending=false;
        if(chrome.runtime.lastError||!response||response.error){
          state.update={...state.update,status:'error',message:response?.error||'Não foi possível consultar o GitHub.'};
        }else{
          state.update={status:'ok',version:response.version,url:response.url,downloadUrl:response.downloadUrl||'',checkedAt:Date.now(),message:''};
        }
        if(state.tab==='settings')scheduleRender();
      });
    }catch{
      updatePending=false;
      state.update={...state.update,status:'error',message:'Serviço de atualizações indisponível.'};
      if(state.tab==='settings')scheduleRender();
    }
  }
  function openUpdatePage(download=false){
    const target=download&&state.update.downloadUrl?state.update.downloadUrl:state.update.url||'https://github.com/mrooger/CommunityDEX/releases';
    if(!/^https:\/\/github\.com\/mrooger\/CommunityDEX\/releases(?:\/|$)/.test(target))return;
    window.open(target,'_blank','noopener,noreferrer');
  }
  function updateNavDensity(){
    if(!panel)return;
    const width=panel.getBoundingClientRect().width;
    panel.dataset.navDensity=width<=352?'tiny':width<=450?'compact':'normal';
  }
  function settings(){
    const order=state.prefs.tabOrder.filter(id=>OPTIONAL_TABS.includes(id));
    const tabs=order.map((id,i)=>{const [_,title,ico]=TAB_META.find(row=>row[0]===id);return `<div class="sd-order-row"><span class="sd-order-icon">${ico}</span><span class="sd-grow">${E(title)}</span><label class="sd-toggle"><input type="checkbox" data-tab-visible="${id}" ${state.prefs.tabVisible[id]!==false?'checked':''} aria-label="Exibir ${E(title)}"><span></span></label><button data-action="tab-up" data-value="${id}" title="Mover para cima" ${i===0?'disabled':''}>↑</button><button data-action="tab-down" data-value="${id}" title="Mover para baixo" ${i===order.length-1?'disabled':''}>↓</button></div>`;}).join('');
    const boxes=Object.entries(SECTIONS).map(([id,fields])=>{const title=TAB_META.find(row=>row[0]===id)?.[1]||id;return `<div class="sd-options-group"><h4>${E(title)}</h4>${fields.map(([key,label])=>`<label class="sd-opt-row"><input type="checkbox" data-section-visible="${E(key)}" ${sectionShown(key)?'checked':''}><span>${E(label)}</span></label>`).join('')}</div>`;}).join('');
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">PERSONALIZE DO SEU JEITO</span><h3>⚙ Central de ajustes</h3></div><span class="sd-pill sd-gold">✓ Salvo</span></div>
    ${updatePanel()}
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">◫</span><div><h4>Organizar abas</h4><p>Mostre, esconda e reorganize com as setas.</p></div></div>${tabs}<p class="sd-note">A área Ajustes permanece disponível para você reorganizar o painel quando quiser.</p></div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">✧</span><div><h4>Visibilidade dos módulos</h4><p>Escolha exatamente quais blocos aparecem em cada aba.</p></div></div>${boxes}</div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">◉</span><div><h4>Experiência da Pokédex</h4><p>Leitura e abertura do painel personalizáveis.</p></div></div>${toggle('enabled','Reconhecer Pokémon','Identificar fichas ao passar o mouse')}${toggle('autoPokemon','Abrir Pokédex automaticamente','Mostra a ficha dentro do Community Dex ao passar o mouse')}${toggle('toasts','Avisos na tela','Alertas visuais para eventos importantes')}${toggle('shinyBadge','Número de Shinies no ícone','Exibir o contador sobre o ícone da Community Dex')}${toggle('floatingButton','Botão flutuante Smart Dex','Oculta o acesso flutuante e a abertura automática no Smart Dex. Alt + P continua disponível.')}</div>
    <div class="sd-panelcard sd-mode-card"><div class="sd-card-heading"><span class="sd-section-icon">▣</span><div><h4>Estilo da Community Dex</h4><p>Escolha como deseja acessar e visualizar seu painel.</p></div></div><div class="sd-modes"><button type="button" data-action="dex-mode" data-value="smart" class="sd-mode-option ${state.prefs.dexMode==='smart'?'active':''}" aria-pressed="${state.prefs.dexMode==='smart'}"><span class="sd-mode-symbol">◉</span><b>Smart Dex</b><small>Janela independente e compacta.</small></button><button type="button" data-action="dex-mode" data-value="complete" class="sd-mode-option ${state.prefs.dexMode==='complete'?'active':''}" aria-pressed="${state.prefs.dexMode==='complete'}"><span class="sd-mode-symbol">▤</span><b>Complete Dex</b><small>Cabeçalho fixo, conteúdo recolhível e janela redimensionável.</small></button></div><p class="sd-note">No Complete Dex, arraste o cabeçalho para mover e o canto inferior direito para ajustar largura e altura.</p></div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">◈</span><div><h4>Aparência</h4><p>Configurações do seu painel.</p></div></div>${toggle('compact','Modo compacto','Painel mais estreito, com menos espaço')}
    <div class="sd-miniheading">Opacidade do painel · <output id="sd-opacity-label">${state.prefs.opacity}%</output></div><input type="range" min="75" max="100" step="1" value="${state.prefs.opacity}" id="sd-opacity-slider"></div>
    <div class="sd-panelcard"><h4>✦ Precisão do cálculo de IV</h4><p>Selecione o limite individual usado nas estimativas.</p><div class="sd-segments"><button class="sd-segment ${state.prefs.ivMax===31?'active':''}" data-action="max-iv" data-value="31">31 IV</button><button class="sd-segment ${state.prefs.ivMax===32?'active':''}" data-action="max-iv" data-value="32">32 IV</button></div></div>
    <div class="sd-panelcard"><div class="sd-flex"><div><h4>↻ Restaurar preferências</h4><p>Reorganiza a interface sem apagar as estatísticas.</p></div><button class="sd-ghost sd-xs" data-action="reset-preferences">Restaurar</button></div></div>
    <div class="sd-credit">COMMUNITY DEX · v1.4.0</div></section>`;
  }
  const toggle=(key,label,sub)=>`<div class="sd-flex sd-pref"><div><h4>${E(label)}</h4><p>${E(sub)}</p></div><label class="sd-toggle"><input type="checkbox" data-pref="${E(key)}" ${state.prefs[key]?'checked':''}><span></span></label></div>`;
  const TABS=TAB_META;
  const screens={overview,pokemon,hunt,captures,shiny,stream,settings};
  const activeTabs=()=>{
    const ordered=state.prefs.tabOrder.filter(id=>OPTIONAL_TABS.includes(id)&&state.prefs.tabVisible[id]!==false);
    return [...ordered,'settings'];
  };
  function construct(){
    if(document.getElementById('community-dex-root'))return;
    host=document.createElement('div');host.id='community-dex-root';host.dataset.compact=String(state.prefs.compact);document.documentElement.append(host);
    const logo=chrome.runtime.getURL('icons/icon128.png');
    dock=document.createElement('button');dock.type='button';dock.id='sd-dock';dock.title='Clique para abrir • arraste para mover • Alt + P';dock.setAttribute('aria-label','Abrir ou fechar Community Dex');
    dock.innerHTML=`<img class="sd-dock-logo" src="${E(logo)}" alt="" draggable="false"><i id="sd-dock-count"></i>`;
    dock.addEventListener('pointerdown',startDockDrag);
    dock.addEventListener('click',()=>{if(suppressDockClick){suppressDockClick=false;return;}state.open=!state.open;render();});
    panel=document.createElement('div');panel.id='sd-panel';panel.innerHTML=`<header id="sd-titlebar"><div class="sd-brand"><div class="sd-brand-mark"><img class="sd-brand-logo" src="${E(logo)}" alt="" draggable="false"></div><div><strong>COMMUNITY <em>DEX</em></strong><span>SUA FERRAMENTA POKÉMON</span></div></div><div class="sd-header-actions"><button id="sd-min" title="Minimizar ou expandir">−</button><button id="sd-close" title="Fechar">×</button></div></header><div id="sd-statusbar"></div><nav id="sd-nav"></nav><main id="sd-body"></main><footer id="sd-footer"><span>ALT + P · Painel</span><span>Versão v1.4.0</span></footer><span id="sd-resize-grip" role="button" aria-label="Arraste para ajustar largura e altura" title="Arraste para ajustar largura e altura">◢</span>`;
    alertBox=document.createElement('div');alertBox.id='sd-alerts';
    host.append(dock,panel,alertBox);
    body=panel.querySelector('#sd-body');
    panel.querySelector('#sd-close').addEventListener('click',()=>{state.open=false;render();});
    panel.querySelector('#sd-min').addEventListener('click',()=>{state.min=!state.min;render();});
    panel.querySelector('.sd-brand-mark').addEventListener('click',()=>{if(state.prefs.dexMode==='complete'){state.min=!state.min;render();}});
    panel.querySelector('#sd-resize-grip').addEventListener('pointerdown',beginResize);
    panel.querySelector('#sd-nav').addEventListener('click',ev=>{const b=ev.target.closest('[data-tab]');if(!b)return;state.tab=b.dataset.tab;body.scrollTop=0;render();});
    panel.addEventListener('click',onAction);
    panel.addEventListener('error',ev=>{if(ev.target?.matches?.('.sd-artwork'))ev.target.hidden=true;if(ev.target?.matches?.('.sd-capture-sprite')){const wrap=ev.target.parentElement;ev.target.remove();if(wrap)wrap.textContent='◉';}},true);
    panel.addEventListener('change',onChange);
    body.addEventListener('scroll',event=>{if(event.target?.classList?.contains('sd-list-scroll'))lastListScroll=now();},true);
    panel.addEventListener('input',onInput);
    panel.querySelector('#sd-titlebar').addEventListener('pointerdown',beginDrag);
    if(typeof ResizeObserver!=='undefined'){navObserver=new ResizeObserver(updateNavDensity);navObserver.observe(panel);}
    window.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyP'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();state.open=!state.open;render();}});
    window.addEventListener('resize',()=>{if(state.prefs.dexMode==='complete')applyCompleteGeometry();else if(state.pos)applyPos();applyDockPos();});
    applyDockPos();
    render();
    if(state.prefs.autoUpdateCheck)checkUpdates();
    setInterval(()=>{if(state.prefs.autoUpdateCheck)checkUpdates();},6*60*60*1000);
  }
  function startDockDrag(ev){
    if(state.prefs.dexMode==='complete'||ev.button!==0)return;
    const rect=dock.getBoundingClientRect();
    dockDrag={pointerId:ev.pointerId,startX:ev.clientX,startY:ev.clientY,left:rect.left,top:rect.top,moved:false};
    dock.setPointerCapture?.(ev.pointerId);
    dock.addEventListener('pointermove',moveDockDrag);
    dock.addEventListener('pointerup',stopDockDrag,{once:true});
    dock.addEventListener('pointercancel',cancelDockDrag,{once:true});
  }
  function moveDockDrag(ev){
    if(!dockDrag||ev.pointerId!==dockDrag.pointerId)return;
    const dx=ev.clientX-dockDrag.startX,dy=ev.clientY-dockDrag.startY;
    if(!dockDrag.moved&&Math.hypot(dx,dy)<6)return;
    dockDrag.moved=true;
    const w=dock.offsetWidth||64,h=dock.offsetHeight||64;
    state.dockPos={x:Math.max(8,Math.min(innerWidth-w-8,dockDrag.left+dx)),y:Math.max(8,Math.min(innerHeight-h-8,dockDrag.top+dy))};
    applyDockPos();
  }
  function stopDockDrag(ev){
    if(!dockDrag||ev.pointerId!==dockDrag.pointerId)return;
    suppressDockClick=dockDrag.moved;
    if(dockDrag.moved)persist();
    finishDockDrag();
  }
  function cancelDockDrag(){finishDockDrag();}
  function finishDockDrag(){
    dockDrag=null;
    dock.removeEventListener('pointermove',moveDockDrag);
    dock.removeEventListener('pointerup',stopDockDrag);
    dock.removeEventListener('pointercancel',cancelDockDrag);
  }
  function applyDockPos(){
    if(!dock)return;
    if(state.prefs.dexMode==='complete'){for(const attr of ['left','top','right','bottom'])dock.style.removeProperty(attr);return;}
    if(!state.dockPos)return;
    const w=dock.offsetWidth||64,h=dock.offsetHeight||64;
    const x=Math.max(8,Math.min(Math.max(8,innerWidth-w-8),Number(state.dockPos.x)||8));
    const y=Math.max(8,Math.min(Math.max(8,innerHeight-h-8),Number(state.dockPos.y)||8));
    state.dockPos={x,y};
    dock.style.setProperty('left',x+'px','important');
    dock.style.setProperty('top',y+'px','important');
    dock.style.setProperty('right','auto','important');
    dock.style.setProperty('bottom','auto','important');
  }
  function beginDrag(ev){
    if(ev.button!==0||ev.target.closest('button'))return;
    const rect=panel.getBoundingClientRect();drag={x:ev.clientX,y:ev.clientY,left:rect.left,top:rect.top};
    panel.setPointerCapture?.(ev.pointerId);panel.addEventListener('pointermove',moveDrag);panel.addEventListener('pointerup',stopDrag,{once:true});panel.addEventListener('pointercancel',stopDrag,{once:true});
  }
  function moveDrag(ev){if(!drag)return;const pos={x:Math.max(6,Math.min(Math.max(6,innerWidth-panel.offsetWidth-6),drag.left+ev.clientX-drag.x)),y:Math.max(6,Math.min(innerHeight-70,drag.top+ev.clientY-drag.y))};if(state.prefs.dexMode==='complete'){state.completePos=pos;applyCompleteGeometry();}else{state.pos=pos;applyPos();}}
  function stopDrag(){drag=null;panel.removeEventListener('pointermove',moveDrag);persist();}
  function applyPos(){if(!state.pos)return;panel.style.left=Math.max(6,Math.min(Math.max(6,innerWidth-panel.offsetWidth-6),state.pos.x))+'px';panel.style.top=Math.max(6,Math.min(Math.max(6,innerHeight-70),state.pos.y))+'px';panel.style.right='auto';panel.style.bottom='auto';}
  function beginResize(event){
    if(state.prefs.dexMode!=='complete'||state.min||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const rect=panel.getBoundingClientRect();
    resizeDrag={id:event.pointerId,x:event.clientX,y:event.clientY,width:rect.width,height:rect.height};
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.addEventListener('pointermove',moveResize);
    event.currentTarget.addEventListener('pointerup',stopResize,{once:true});
    event.currentTarget.addEventListener('pointercancel',stopResize,{once:true});
  }
  function moveResize(event){
    if(!resizeDrag||resizeDrag.id!==event.pointerId)return;
    const width=Math.max(330,Math.min(innerWidth-16,resizeDrag.width+event.clientX-resizeDrag.x));
    const height=Math.max(255,Math.min(innerHeight-16,resizeDrag.height+event.clientY-resizeDrag.y));
    state.completeSize={width,height};applyCompleteGeometry();
  }
  function stopResize(){
    resizeDrag=null;
    const grip=panel.querySelector('#sd-resize-grip');
    grip.removeEventListener('pointermove',moveResize);grip.removeEventListener('pointerup',stopResize);grip.removeEventListener('pointercancel',stopResize);
    persist();
  }
  function applyCompleteGeometry(){
    if(!panel)return;
    const size=state.completeSize||{width:540,height:750};
    const width=Math.max(Math.min(innerWidth-16,330),Math.min(Math.max(280,innerWidth-16),size.width));
    const height=Math.max(240,Math.min(Math.max(240,innerHeight-16),size.height));
    const pos=state.completePos||{x:Math.max(8,innerWidth-width-140),y:12};
    const x=Math.max(6,Math.min(Math.max(6,innerWidth-width-6),Number(pos.x)||0));
    const y=Math.max(6,Math.min(Math.max(6,innerHeight-(state.min?65:Math.min(height,160))),Number(pos.y)||0));
    panel.style.left=x+'px';panel.style.top=y+'px';panel.style.right='auto';panel.style.bottom='auto';
    panel.style.width=width+'px';panel.style.height=state.min?'auto':height+'px';
  }
  function applySmartGeometry(){
    panel.style.width='';panel.style.height='';panel.style.left='';panel.style.top='';panel.style.right='';panel.style.bottom='';
    if(state.pos)applyPos();
  }
  function render(){
    if(!host)return;
    host.dataset.compact=String(state.prefs.compact);
    host.dataset.dexMode=state.prefs.dexMode;
    panel.style.setProperty('--sd-alpha',String(state.prefs.opacity/100));
    panel.hidden=!state.open;
    panel.classList.toggle('sd-minimized',state.min);
    dock.querySelector('#sd-dock-count').textContent=state.prefs.shinyBadge&&state.shinyLog.length?String(state.shinyLog.length):'';
    dock.hidden=state.open&&state.prefs.dexMode==='complete'||state.prefs.dexMode==='smart'&&!state.prefs.floatingButton;
    dock.classList.remove('sd-hide');
    if(state.prefs.dexMode==='complete'&&!state.open){dock.hidden=false;}
    panel.querySelector('#sd-min').textContent=state.min?'▢':'−';
    if(!activeTabs().includes(state.tab))state.tab=activeTabs()[0]||'settings';
    panel.querySelector('#sd-statusbar').innerHTML=`<span class="sd-live-dot ${status()==='Conectado'?'sd-connected':''}"></span> ${E(status())} <a class="sd-hub-status" href="https://stigalzera.com/" target="_blank" rel="noopener noreferrer">✦ Community Hub ↗</a>`;
    updateNavDensity();
    const nav=panel.querySelector('#sd-nav');const navScroll=nav.scrollLeft;
    nav.style.setProperty('--sd-tab-count',String(activeTabs().length));
    nav.innerHTML=activeTabs().map(id=>{const [_,title,icon]=TABS.find(tab=>tab[0]===id);return `<button type="button" data-tab="${id}" class="${state.tab===id?'selected':''}" title="${title}"><span>${icon}</span><small>${title}</small></button>`;}).join('');nav.scrollLeft=navScroll;
    if(state.open&&!state.min&&screens[state.tab]){
      // Do not replace focused inputs while users are typing.
      const focused=body.contains(document.activeElement)&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
      if(!focused){
        const top=body.scrollTop;
        const listPositions=new Map(Array.from(body.querySelectorAll('[data-scroll-id]')).map(el=>[el.dataset.scrollId,el.scrollTop]));
        body.innerHTML=screens[state.tab]();
        body.scrollTop=top;
        for(const el of body.querySelectorAll('[data-scroll-id]'))el.scrollTop=listPositions.get(el.dataset.scrollId)||0;
      }
    }
    if(state.prefs.dexMode==='complete')applyCompleteGeometry();else if(state.pos)applyPos();
    applyDockPos();
  }
  function onInput(ev){
    const target=ev.target;
    if(target?.id==='sd-tooltip-input')state.manualText=target.value;
    if(target?.dataset.filterInput){const term=C.text(target.value,80).toLowerCase();for(const row of body.querySelectorAll('[data-filter]'))row.hidden=term&&!row.dataset.filter.includes(term);}
    if(target?.id==='sd-opacity-slider'){state.prefs.opacity=Number(target.value);panel.style.setProperty('--sd-alpha',String(state.prefs.opacity/100));const out=body.querySelector('#sd-opacity-label');if(out)out.textContent=state.prefs.opacity+'%';persist();}
  }
  function onChange(ev){
    const target=ev.target;
    if(target?.dataset?.captureKind!==undefined){if(['all','normal','shiny'].includes(target.value)){state.captureTab=target.value;state.catchesExpanded=false;state.streamCatchesExpanded=false;target.blur();render();}return;}
    if(target?.dataset?.captureSort!==undefined){if(['recent','iv','rarity'].includes(target.value)){state.captureSort=target.value;target.blur();render();}return;}
    const pref=target?.dataset?.pref;
    if(pref&&pref in PREF&&typeof PREF[pref]==='boolean'){state.prefs[pref]=target.checked;if(pref==='autoUpdateCheck'&&target.checked)checkUpdates();persist();scheduleRender();return;}
    if(target?.dataset?.tabVisible){const id=target.dataset.tabVisible;if(!OPTIONAL_TABS.includes(id))return;state.prefs.tabVisible[id]=target.checked;persist();scheduleRender();return;}
    if(target?.dataset?.rarity){const key=target.dataset.rarity;if(![...M.RARITIES,'Não informada'].includes(key))return;state.captureRarities=target.checked?[...new Set([...state.captureRarities,key])]:state.captureRarities.filter(r=>r!==key);target.blur();persist();render();return;}
    if(target?.dataset?.sectionVisible){const id=target.dataset.sectionVisible;if(!(id in DEFAULT_SECTIONS))return;state.prefs.sectionVisible[id]=target.checked;persist();scheduleRender();}
  }
  function onAction(event){
    const btn=event.target.closest('button[data-action]');if(!btn)return;
    const action=btn.dataset.action;
    if(action==='toggle-section'){const key=btn.dataset.section;if(!['pokemonTypes','pokemonManual','huntComposition','huntCalculator','overviewLogs','overviewActivity','capturesBalls','shinyDetector'].includes(key))return;state.prefs.expanded[key]=!state.prefs.expanded[key];persist();render();}
    else if(action==='save-manual'){saveManual();toast('LOG salvo','Resumo manual disponível no Histórico & Logs.');}
    else if(action==='view-log'){logViewer(btn.dataset.kind,btn.dataset.id);}
    else if(action==='delete-log'){const kind=btn.dataset.kind,id=btn.dataset.id;if(!['daily','manual'].includes(kind))return;if(!confirm('Excluir este LOG?'))return;if(kind==='daily')state.dailyLogs=state.dailyLogs.filter(v=>v.id!==id);else state.manualLogs=state.manualLogs.filter(v=>v.id!==id);persist();render();}
    else if(action==='toggle-rarity-dropdown'){state.rarityDropdownOpen=!state.rarityDropdownOpen;render();}
    else if(action==='all-rarities'){state.captureRarities=[...M.RARITIES,'Não informada'];persist();render();}
    else if(action==='no-rarities'){state.captureRarities=[];persist();render();}
    else if(action==='show-more-activity'){state.activityExpanded=!state.activityExpanded;render();}
    else if(action==='show-more-catches'){state.catchesExpanded=!state.catchesExpanded;render();}
    else if(action==='show-more-stream-catches'){state.streamCatchesExpanded=!state.streamCatchesExpanded;render();}
    else if(action==='toggle-stream-filters'){state.streamFiltersExpanded=!state.streamFiltersExpanded;render();}
    else if(action==='toggle-capture-filters'){state.capturesFiltersExpanded=!state.capturesFiltersExpanded;render();}
    else if(action==='show-more-history'){state.historyExpanded=!state.historyExpanded;render();}
    else if(action==='show-more-loot'){state.lootExpanded=!state.lootExpanded;render();}
    else if(action==='show-more-shinies'){state.shinyExpanded=!state.shinyExpanded;render();}
    else if(action==='tab-up'||action==='tab-down'){
      const order=state.prefs.tabOrder,id=btn.dataset.value,i=order.indexOf(id),to=i+(action==='tab-up'?-1:1);
      if(i>=0&&to>=0&&to<order.length){[order[i],order[to]]=[order[to],order[i]];persist();render();}
    }
    else if(action==='reset-overview'){
      if(!confirm('Zerar estatísticas de capturas, Shinies, hunt e atividades recentes? Suas preferências e fichas da Pokédex serão mantidas.'))return;
      resetSession();
      state.activityExpanded=false;state.catchesExpanded=false;state.lootExpanded=false;state.shinyExpanded=false;
      persist();render();
    }
    else if(action==='check-updates'){checkUpdates(true);}
    else if(action==='open-release'){openUpdatePage(false);}
    else if(action==='download-update'){openUpdatePage(true);}
    else if(action==='reset-preferences'){state.prefs=structuredClone(PREF);applySmartGeometry();persist();render();}
    else if(action==='dex-mode'){
      const next=btn.dataset.value;if(!['smart','complete'].includes(next))return;
      state.prefs.dexMode=next;state.open=true;state.min=false;
      if(next==='smart')applySmartGeometry();else{if(!state.completePos)state.completePos={x:Math.max(8,innerWidth-720),y:12};applyCompleteGeometry();}
      persist();render();
    }
    else if(action==='pin'){state.pinned=state.pokemon;persist();render();}
    else if(action==='unpin'){state.pinned=null;persist();render();}
    else if(action==='load-history'){const idx=Number(btn.dataset.index);if(state.history[idx]){state.pokemon=state.history[idx];loadBase(state.pokemon.name);render();}}
    else if(action==='copy-scanned'){
      if(state.pokemon)copyText(C.formatPokemonSheet(state.pokemon),'Ficha copiada','Dados do Pokémon prontos para editar.');
    }
    else if(action==='copy-template'){
      const template=C.formatPokemonSheet(null);
      const input=body.querySelector('#sd-tooltip-input');
      if(input&&!input.value.trim()){input.value=template;state.manualText=template;}
      copyText(template,'Modelo copiado','Cole ou edite os campos para analisar.');
    }
    else if(action==='parse-manual'){
      const raw=body.querySelector('#sd-tooltip-input')?.value||state.manualText;const p=C.parseTooltip(raw);
      if(p){storePokemon(p);toast('Ficha reconhecida',p.name+' • Nível '+p.level);}else toast('Não foi possível analisar','Inclua nível e pelo menos 4 atributos no texto.');
    }
    else if(action==='reset-hunt'){if(!confirm('Zerar os dados da Hunt atual?'))return;state.kills=[];state.parts={};state.loot={};state.totalXp=null;state.level=null;state.session.kills=0;state.session.xp=0;state.session.parts={};state.session.loot={};persist();render();}
    else if(action==='clear-catches'){if(!confirm('Zerar os dados de capturas desta sessão?'))return;state.catches=[];state.session.captures=0;state.session.attempts=0;state.session.shinyCaptures=0;state.session.balls={};state.session.recentCaptures=[];state.session.bestCapture=null;persist();render();}
    else if(action==='clear-shiny'){if(!confirm('Zerar os encontros Shiny desta sessão?'))return;state.shinyLog=[];state.shinyTracker.reset();state.session.shinyEncounters=0;state.session.shinyHistory=[];persist();render();}
    else if(action==='max-iv'){state.prefs.ivMax=Number(btn.dataset.value)===31?31:32;persist();render();}
    else if(action==='calculate-xp'){
      const current=Math.floor(Number(body.querySelector('#sd-xp-from')?.value)||1),target=Math.floor(Number(body.querySelector('#sd-xp-to')?.value)||1);
      const out=body.querySelector('#sd-xp-result');if(!out)return;
      if(current<1||target<=current||target>10000){out.textContent='Informe um nível alvo maior que o atual, até 10.000.';return;}
      out.textContent='Do nível '+F(current)+' até '+F(target)+': '+F(C.xpForLevel(target)-C.xpForLevel(current))+' XP acumulada.';
      state.huntTarget=target;persist();
    }
    else if(action==='export-catches'){const head=['data','pokemon','ball','shiny','raridade','iv','automatico'];const lines=state.catches.map(c=>[new Date(c.t).toISOString(),c.name,c.ball,c.shiny,c.rarity||'',c.ivTotal??'',c.auto].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));download('community-dex-capturas.csv','\ufeff'+[head.join(','),...lines].join('\r\n'),'text/csv;charset=utf-8');}

  }
  async function copyText(value,title,description){
    let ok=false;
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);ok=true;}
    }catch{}
    if(!ok){
      const field=document.createElement('textarea');
      field.value=value;field.setAttribute('readonly','');
      field.style.cssText='position:fixed;left:-10000px;top:0;opacity:0';
      host.append(field);field.select();
      try{ok=document.execCommand('copy');}catch{}
      field.remove();
    }
    toast(ok?title:'Cópia não permitida',ok?description:'Selecione o texto e copie manualmente.');
  }
  function download(filename,content,mime){const url=URL.createObjectURL(new Blob([content],{type:mime}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);}
  async function loadSpeciesCatalog(){
    const update=()=>{
      const cleaned=C.normalizeShinyHistory(state.shinyLog);
      if(JSON.stringify(cleaned)!==JSON.stringify(state.shinyLog)){
        state.shinyLog=cleaned;persist();scheduleRender();
      }
    };
    try{
      const response=await fetch('/game/creatures.json',{credentials:'same-origin',cache:'force-cache'});
      if(response.ok){C.registerSpeciesCatalog(await response.json());update();}
    }catch{}
    try{
      chrome.runtime.sendMessage({action:'species-catalog'},reply=>{
        if(chrome.runtime.lastError||!Array.isArray(reply?.creatures))return;
        C.registerSpeciesCatalog(reply.creatures);update();
      });
    }catch{}
  }
  async function init(){
    try{
      const stored=await chrome.storage.local.get([STORE,LEGACY_STORE]);const saved=stored[STORE]||stored[LEGACY_STORE]||{};
      const pv=saved.prefs||{};state.prefs={...structuredClone(PREF),...pv,tabVisible:{...PREF.tabVisible,...(pv.tabVisible||{})},sectionVisible:{...PREF.sectionVisible,...(pv.sectionVisible||{})},expanded:{...PREF.expanded,...(pv.expanded||{})}};
      state.prefs.tabOrder=[...new Set([...(Array.isArray(pv.tabOrder)?pv.tabOrder:[]),...OPTIONAL_TABS])].filter(id=>OPTIONAL_TABS.includes(id));
      if(!['smart','complete'].includes(state.prefs.dexMode))state.prefs.dexMode='smart';
      state.pinned=saved.pinned||null;
      for(const key of ['history','catches','shinyLog'])if(Array.isArray(saved[key]))state[key]=saved[key].slice(0,key==='catches'?200:200);
      const normalized=C.normalizeShinyHistory(state.shinyLog);
      const changed=JSON.stringify(state.shinyLog)!==JSON.stringify(normalized);
      state.shinyLog=normalized;
      state.shinyTracker.prime(normalized);
      state.dailyLogs=M.prune(saved.dailyLogs,'daily');state.manualLogs=M.prune(saved.manualLogs,'manual');
      if(Array.isArray(saved.captureRarities)){
        const previous=['Comum','Incomum','Raro','Épico','Lendário','Não informada'];
        const allPrevious=previous.length===saved.captureRarities.length&&previous.every(r=>saved.captureRarities.includes(r));
        state.captureRarities=allPrevious?[...M.RARITIES,'Não informada']:saved.captureRarities.filter(x=>[...M.RARITIES,'Não informada'].includes(x));
      }
      if(changed)persist();
      state.pos=saved.pos||null;state.dockPos=saved.dockPos||null;state.completePos=saved.completePos||null;state.completeSize=saved.completeSize||null;
      if(state.prefs.dexMode==='complete')state.open=true;state.huntTarget=saved.huntTarget||150;state.pokeTarget=saved.pokeTarget||100;
      try{const hunt=JSON.parse(sessionStorage.getItem(STORE+':hunt')||sessionStorage.getItem(LEGACY_STORE+':hunt')||'null');if(hunt){state.kills=Array.isArray(hunt.kills)?hunt.kills.slice(-1400):[];state.parts=hunt.parts||{};state.loot=hunt.loot||{};state.totalXp=hunt.totalXp;state.level=hunt.level;}}catch{}
      state.session=saved.session&&Number.isFinite(saved.session.startAt)?saved.session:(state.kills.length||state.catches.length||state.shinyLog.length?M.fromLegacy(state.kills,state.catches,state.shinyLog):M.fresh());
      if(!saved.session){state.parts={...state.session.parts};state.loot={...state.session.loot};}
      state.catches=state.session.recentCaptures?.slice(0,200)||state.catches;
      M.refreshBest(state.session);
      if(saved.session){state.parts={...state.session.parts};state.loot={...state.session.loot};state.shinyLog=state.session.shinyHistory?.slice(0,200)||state.shinyLog;state.shinyTracker.reset();state.shinyTracker.prime(state.shinyLog);}
      closeElapsed();
    }catch{}
    const ready=()=>{if(!document.body){document.addEventListener('DOMContentLoaded',ready,{once:true});return;}construct();initObserver();loadSpeciesCatalog();};
    ready();
    setTimeout(()=>{if(state.catches.some(c=>c.quality==null||c.ivTotal==null))requestCaptureLog();},2300);
    setInterval(()=>{closeElapsed();},60000);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else closeElapsed();});
    window.addEventListener('pagehide',flush);
    setInterval(flush,15000);
  }
  init();
})();
