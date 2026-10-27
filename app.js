/* Community Dex · Game companion */
(() => {
  'use strict';
  if(!/^\/play(?:\/|$)/.test(location.pathname) || window.__communityDexApp) return;
  window.__communityDexApp=true;
  const C=globalThis.CommunityCore;
  const CH='__COMMUNITY_DEX_EVENTS_V1__';
  const STORE='community-dex:v1';
  const LEGACY_STORE='stigal-dex:v1';
  const TAB_META=[['overview','Visão geral','◫'],['pokemon','Pokédex','◉'],['hunt','Hunt','⚡'],['captures','Capturas','◈'],['shiny','Shinies','✦'],['settings','Ajustes','⚙']];
  const OPTIONAL_TABS=['overview','pokemon','hunt','captures','shiny'];
  const SECTIONS={overview:[['overviewMetrics','Indicadores'],['overviewActivity','Atividade recente']],pokemon:[['pokemonTypes','Efetividades'],['pokemonStats','Atributos'],['pokemonManual','Leitura manual'],['pokemonHistory','Histórico de fichas']],hunt:[['huntLoot','Loot'],['huntComposition','Composição de XP'],['huntCalculator','Calculadora de XP']],captures:[['capturesBalls','Resultados por bola'],['capturesRecent','Últimas tentativas']],shiny:[['shinyDetector','Detector e áudio'],['shinyHistory','Histórico de Shinies']]};
  const DEFAULT_SECTIONS=Object.fromEntries(Object.values(SECTIONS).flat().map(([key])=>[key,true]));
  const DEFAULT_COLLAPSE={pokemonManual:false,huntComposition:false,huntCalculator:false};
  const PREF={enabled:true,autoPokemon:true,shiny:true,sound:false,toasts:true,compact:false,ivMax:32,opacity:96,tabOrder:OPTIONAL_TABS,tabVisible:Object.fromEntries(OPTIONAL_TABS.map(id=>[id,true])),sectionVisible:DEFAULT_SECTIONS,expanded:DEFAULT_COLLAPSE};
  const XP_LABELS={base:'XP base',vip:'Bônus VIP',boost:'Bônus de XP',streak:'Bônus de sequência',event:'Bônus de evento',typeDay:'Bônus do tipo do dia',typeday:'Bônus do tipo do dia',stream:'Bônus da stream',streamer:'Bônus da stream',twitch:'Bônus da Twitch',pokedex:'Bônus da Pokédex',other:'Outros bônus'};
  const sectionShown=key=>state.prefs.sectionVisible[key]!==false;
  const sectionExpanded=key=>Boolean(state.prefs.expanded[key]);
  const expandable=(key,title,icon,inside,{open=false,count=''}={})=>`<div class="sd-panelcard sd-expandable"><button type="button" class="sd-collapse-head" data-action="toggle-section" data-section="${E(key)}" aria-expanded="${sectionExpanded(key)}"><span class="sd-section-icon">${icon}</span><span class="sd-grow"><b>${E(title)}</b>${count?`<small>${E(count)}</small>`:''}</span><span class="sd-chevron">${sectionExpanded(key)?'⌃':'⌄'}</span></button>${sectionExpanded(key)?`<div class="sd-collapse-content">${inside}</div>`:''}</div>`;
  const buttonMore=(action,expanded,total,limit)=>total>limit?`<button class="sd-more" data-action="${action}">${expanded?'Mostrar apenas '+limit:'Ver mais '+(total-limit)} <span>${expanded?'⌃':'⌄'}</span></button>`:'';
  const eventHtml=v=>`<div class="sd-event"><span class="sd-event-icon">${v.type==='shiny'?'✦':v.type==='capture'?'◈':'◉'}</span><span>${E(v.msg)}</span><time>${formatTime(v.t)}</time></div>`;
  const captureHtml=c=>`<div class="sd-event"><span class="sd-event-icon ${c.success?'sd-positive':'sd-negative'}">${c.success?'✓':'×'}</span><span><b>${E(c.name)}</b> <small>· ${E(c.ball)}</small></span><time>${formatTime(c.t)}</time></div>`;
  const state={
    prefs:structuredClone(PREF),tab:'overview',open:false,min:false,pos:null,bridge:'Aguardando',socket:'aguardando',wsMessages:0,lastPacket:0,
    pokemon:null,pinned:null,history:[],base:{},basePending:new Set(),baseErrors:{},
    kills:[],totalXp:null,level:null,parts:{},loot:{},
    catches:[],shinyLog:[],shiniesSeen:new Map(),
    feed:[],huntTarget:150,pokeTarget:100,activityExpanded:false,catchesExpanded:false,historyExpanded:false,lootExpanded:false,shinyExpanded:false,manualText:'',dockPos:null
  };
  const now=()=>Date.now();
  const E=C.escape,F=C.format,S=C.short;
  let host,panel,dock,body,alertBox;
  let renderTimer=null,saveTimer=null,tooltipTimer=null,lastTooltipKey='',drag=null,dockDrag=null,suppressDockClick=false;
    const persist=()=>{
    if(saveTimer)clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const record={prefs:state.prefs,pinned:state.pinned,history:state.history.slice(0,50),catches:state.catches.slice(0,400),shinyLog:state.shinyLog.slice(0,120),pos:state.pos,dockPos:state.dockPos,huntTarget:state.huntTarget,pokeTarget:state.pokeTarget};
      try{chrome.storage.local.set({[STORE]:record});}catch{}
      try{sessionStorage.setItem(STORE+':hunt',JSON.stringify({kills:state.kills.slice(-1000),parts:state.parts,loot:state.loot,totalXp:state.totalXp,level:state.level}));}catch{}
    },600);
  };
  const log=(type,msg)=>{state.feed.unshift({t:now(),type,msg:C.text(msg,140)});state.feed.length=Math.min(45,state.feed.length);};
  const formatTime=t=>t?new Date(t).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}):'—';
  const formatDate=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  const status=()=>{
    if(state.socket==='open'&&state.wsMessages>0)return 'Conectado';
    if(state.socket==='open')return 'Socket aberto';
    if(state.socket==='closed')return 'Reconectando';
    if(state.bridge==='error')return 'Erro no leitor';
    if(state.socket==='created')return 'Conectando';
    return 'Aguardando jogo';
  };
  const stats=()=>{
    const wins=state.catches.filter(x=>x.success).length;
    return {attempts:state.catches.length,catches:wins,wins,rate:state.catches.length?100*wins/state.catches.length:0,shiny:state.shinyLog.length,xp:state.kills.reduce((a,k)=>a+k.xp,0),kills:state.kills.length};
  };
  function audio(){if(!state.prefs.sound)return;try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const start=ctx.currentTime;[660,990,1320].forEach((hz,i)=>{const osc=ctx.createOscillator();const gain=ctx.createGain();osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(.0001,start+i*.115);gain.gain.exponentialRampToValueAtTime(.06,start+i*.115+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+i*.115+.18);osc.connect(gain).connect(ctx.destination);osc.start(start+i*.115);osc.stop(start+i*.115+.2);});setTimeout(()=>ctx.close().catch(()=>{}),950);}catch{}}
  function toast(title,sub){if(!state.prefs.toasts||!alertBox)return;const el=document.createElement('div');el.className='sd-toast';const h=document.createElement('strong');h.textContent=C.text(title,70);const p=document.createElement('span');p.textContent=C.text(sub,120);el.append(h,p);alertBox.append(el);while(alertBox.children.length>3)alertBox.firstElementChild?.remove();setTimeout(()=>el.remove(),5000);}
  function onShiny(event){
    if(!state.prefs.shiny)return;
    const seen=state.shiniesSeen;
    if(seen.has(event.key)&&now()-seen.get(event.key)<10*60*1000)return;
    seen.set(event.key,now());
    if(seen.size>600){for(const [k,t] of seen)if(now()-t>10*60*1000)seen.delete(k);}
    state.shinyLog.unshift(event);state.shinyLog.length=Math.min(120,state.shinyLog.length);
    log('shiny','✨ '+event.name+' detectado');toast('✨ Shiny detectado!',event.name+' • '+formatTime(event.t));audio();persist();
  }
  function onKill(k){
    const prev=state.kills.at(-1);
    if(prev&&Math.abs(prev.t-k.t)<500&&prev.totalXp!==null&&k.totalXp!==null&&prev.totalXp===k.totalXp)return;
    state.kills.push(k);state.kills=state.kills.slice(-1400);
    if(k.totalXp!==null)state.totalXp=k.totalXp;if(k.level!==null)state.level=k.level;
    for(const [key,v] of Object.entries(k.parts))state.parts[key]=(state.parts[key]||0)+v;
    for(const item of k.loot)state.loot[item.name]=(state.loot[item.name]||0)+item.qty;
    if(state.kills.length%12===0)persist();
  }
  function onCapture(c){
    const prev=state.catches[0];
    if(prev&&prev.name===c.name&&prev.ball===c.ball&&prev.success===c.success&&Math.abs(prev.t-c.t)<900)return;
    state.catches.unshift(c);state.catches.length=Math.min(400,state.catches.length);
    log('capture',(c.success?'✓ ':'× ')+c.name+' • '+c.ball);
    persist();
  }
  function acceptPacket(packet){
    if(!packet||typeof packet!=='object')return;
    state.lastPacket=now();
    try{for(const s of C.shinyFrom(packet))onShiny(s);}catch{}
    try{for(const c of C.captureFrom(packet))onCapture(c);}catch{}
    try{for(const k of C.killFrom(packet))onKill(k);}catch{}
    scheduleRender();
  }
  window.addEventListener('message',event=>{
    if(event.source!==window||event.origin!==location.origin)return;
    const m=event.data;
    if(!m||m.channel!==CH||!['bridge','heartbeat','socket','packet'].includes(m.type))return;
    const p=m.payload||{};
    if(m.type==='bridge')state.bridge=p.state==='ready'?'Ativo':'error';
    if(m.type==='socket')state.socket=['created','open','closed','error'].includes(p.state)?p.state:'aguardando';
    if(typeof p.messages==='number')state.wsMessages=p.messages;
    if(m.type==='packet')acceptPacket(p.data);
    else scheduleRender();
  });
  function scheduleRender(){if(renderTimer)return;renderTimer=setTimeout(()=>{renderTimer=null;render();},380);}
  function storePokemon(p){
    const sig=[p.name,p.level,p.quality,...Object.values(p.stats)].join(':');
    if(sig===lastTooltipKey&&state.pokemon&&[state.pokemon.name,state.pokemon.level,state.pokemon.quality,...Object.values(state.pokemon.stats)].join(':')===sig)return;
    lastTooltipKey=sig;
    state.pokemon=p;
    state.history=state.history.filter(v=>[v.name,v.level,v.quality,...Object.values(v.stats)].join(':')!==sig);
    state.history.unshift(p);state.history.length=Math.min(50,state.history.length);
    loadBase(p.name);
    if(state.prefs.autoPokemon&&state.prefs.tabVisible.pokemon!==false){state.tab='pokemon';state.open=true;state.min=false;}
    log('pokemon','Lido: '+p.name+' • Lv '+p.level);persist();scheduleRender();
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
      document.addEventListener('mouseover',hovered,true);
      const ob=new MutationObserver(muts=>{
        let needsScan=false;
        for(const m of muts){
          const parent=m.target?.nodeType===1?m.target:m.target?.parentElement;
          if(parent?.closest?.('#community-dex-root'))continue;
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
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">SEU PAINEL</span><h3>Visão geral <span class="sd-title-emoji">✧</span></h3></div><div class="sd-overview-actions"><span class="sd-pill sd-gold">✦ Community Dex</span><button type="button" class="sd-reset-overview" data-action="reset-overview" title="Zerar as estatísticas e atividades, mantendo suas preferências e a Pokédex">↻ Zerar estatísticas</button></div></div>
      ${sectionShown('overviewMetrics')?`<div class="sd-metrics">${card('Shinies encontrados',F(t.shiny),'Histórico de encontros','sd-accent','✦')}${card('Capturas',F(t.catches),F(t.rate,1)+'% de sucesso','sd-purple','◈')}${card('Abates na sessão',F(t.kills),S(t.xp)+' XP','sd-blue','⚔')}${card('Ritmo da hunt',rates.xpHour===null?'—':S(rates.xpHour),'XP por hora ativa','sd-greenish','⚡')}</div>`:''}
      <a class="sd-hub-link" href="https://stigalzera.com/" target="_blank" rel="noopener noreferrer"><span class="sd-hub-emblem">✦</span><span class="sd-grow"><b>Community Hub</b><small>stigalzera.com · Entre na comunidade</small></span><span class="sd-hub-arrow">↗</span></a>
      ${sectionShown('overviewActivity')?`<div class="sd-section-head"><h3>⌁ Atividade recente</h3><span class="sd-pill">${F(state.feed.length)} eventos</span></div>${activity.length?activity.map(eventHtml).join(''):empty('A atividade aparece aqui conforme você joga.','⌁')}${buttonMore('show-more-activity',state.activityExpanded,state.feed.length,5)}`:''}
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
    <div class="sd-pokemon-actions">${official}${p.power!==null&&p.power!==undefined?`<span class="sd-pill sd-gold">⚡ Poder: ${F(p.power)}</span>`:''}<button type="button" class="sd-ghost sd-xs sd-copy-scanned" data-action="copy-scanned" title="Copiar esta ficha em texto editável">▣ Copiar ficha</button>${withPin?`<button class="sd-ghost sd-xs" data-action="pin">${state.pinned?.name===p.name?'✓ Fixado':'♧ Comparar'}</button>`:''}</div>
    ${ivHtml}
    ${sectionShown('pokemonTypes')?`<div class="sd-miniheading">⚔ Fraquezas ${matrix.weak.length?'':'· sem dados'}</div><div class="sd-tagrow">${chips(matrix.weak,'sd-weak')}</div><div class="sd-miniheading">🛡 Resistências</div><div class="sd-tagrow">${chips(matrix.resist,'sd-resist')}</div>${matrix.immune.length?`<div class="sd-miniheading">✧ Imunidades</div><div class="sd-tagrow">${chips(matrix.immune,'sd-immune')}</div>`:''}`:''}
    ${sectionShown('pokemonStats')?`<div class="sd-miniheading">✧ Atributos atuais</div><div class="sd-valuegrid">${Object.entries(C.STAT_NAMES).map(([key,label])=>`<div><small>${E(label)}</small><b>${F(p.stats?.[key])}</b></div>`).join('')}</div>`:''}</article>`;
  }
  function pokemon(){
    const p=state.pokemon;
    let compare='';
    if(state.pinned&&p){const diff=['hp','atk','def','spa','spd','spe'].map(k=>{const a=p.stats?.[k],b=state.pinned.stats?.[k];return `<div class="sd-compare"><span>${E(C.STAT_NAMES[k])}</span><b>${F(b)}</b><b>${F(a)} <small class="${a>b?'sd-positive':a<b?'sd-negative':''}">${a!==null&&b!==null?(a-b>0?'+':'')+F(a-b):''}</small></b></div>`;}).join('');compare=`<div class="sd-panelcard"><div class="sd-section-head"><h3>Comparação de exemplares</h3><button class="sd-ghost sd-xs" data-action="unpin">Remover</button></div><div class="sd-compare"><b>Atributo</b><b>${E(state.pinned.name)}</b><b>Atual</b></div>${diff}</div>`;}
    return `<section class="sd-stack"><div class="sd-section-head"><h3>Pokédex inteligente</h3><span class="sd-pill">Ao passar o mouse</span></div>
      ${p?pokemonCard(p):empty('Passe o mouse sobre um Pokémon no inventário para ler a ficha.','◉')}
      ${compare}${sectionShown('pokemonManual')?expandable('pokemonManual','Leitura manual','✎',`<p>Edite uma ficha abaixo ou cole os dados de um Pokémon.</p><textarea id="sd-tooltip-input" rows="6" spellcheck="false" placeholder="Nome do Pokémon&#10;Lv 100 · Quality ×1.80&#10;HP 350 · Atk 240 · Def 210">${E(state.manualText)}</textarea><div class="sd-manual-actions"><button type="button" class="sd-btn" data-action="parse-manual">◉ Analisar ficha</button><button type="button" class="sd-ghost sd-copy-btn" data-action="copy-template" title="Copiar modelo de ficha e preencher o campo quando vazio">▣ Copiar modelo</button></div>`,{count:'Toque para inserir ou analisar uma ficha'}):''}
      ${sectionShown('pokemonHistory')?`<div class="sd-panelcard"><div class="sd-section-head"><h4>◷ Histórico recente</h4><small>${state.history.length} fichas</small></div>
      ${state.history.length?state.history.slice(0,state.historyExpanded?50:5).map((h,i)=>`<button class="sd-history" data-action="load-history" data-index="${i}"><span>◉</span><b>${E(h.name)}</b><small>Lv ${F(h.level)} · ×${F(h.quality,2)}</small></button>`).join(''):empty('Ainda não existem análises salvas.')}${buttonMore('show-more-history',state.historyExpanded,state.history.length,5)}</div>`:''}</section>`;
  }
  function hunt(){const r=C.huntRates(state.kills),t=stats(),loot=Object.entries(state.loot).sort((a,b)=>b[1]-a[1]).slice(0,50),sum=Object.values(state.parts).reduce((a,b)=>a+(Number(b)||0),0);
    const parts=Object.entries(state.parts).filter(([,value])=>Number(value)>0).sort((a,b)=>b[1]-a[1]);
    const canPercent=t.xp>0&&Math.abs(sum-t.xp)<=Math.max(1,t.xp*0.015);
    const names=parts.map(([k,v])=>`<div class="sd-xp-row"><div class="sd-flex"><span>${E(XP_LABELS[k]||XP_LABELS[k.toLowerCase()]||k.replace(/([a-z])([A-Z])/g,'$1 $2'))}</span><b>${canPercent?F(100*v/t.xp,1)+'%':S(v)+' XP'}</b></div><div class="sd-track"><i style="width:${Math.max(0,Math.min(100,100*v/Math.max(sum,1)))}%"></i></div></div>`).join('');
    const composition=sectionShown('huntComposition')?expandable('huntComposition','Composição da experiência','◈',sum?`${names}<p class="sd-note">${canPercent?'Percentuais sobre a XP total da sessão.':'Os detalhes informados não coincidem com a XP total. Por enquanto, mostramos os valores absolutos em vez de porcentagens imprecisas.'}</p>`:empty('Aguardando dados de XP da hunt.'),{count:'Detalhamento de bônus'}):'';
    const calculator=sectionShown('huntCalculator')?expandable('huntCalculator','Calculadora de XP','⌁',`<p>Planeje sua evolução por nível.</p><div class="sd-fields"><label>Nível atual<input id="sd-xp-from" type="number" min="1" max="9999" value="${Math.floor(state.level||1)}"></label><label>Nível alvo<input id="sd-xp-to" type="number" min="2" max="10000" value="${Math.floor(state.huntTarget)}"></label></div><button class="sd-btn" data-action="calculate-xp">⚡ Calcular XP</button><div id="sd-xp-result" class="sd-softline">Informe os níveis para calcular.</div>`):'';
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">SUA EVOLUÇÃO</span><h3>⚡ Tracker de hunt</h3></div><button class="sd-ghost sd-xs" data-action="reset-hunt">↻ Zerar</button></div>
    <div class="sd-metrics">${card('XP da sessão',S(t.xp),'Experiência obtida','sd-accent','✦')}${card('XP por hora',r.xpHour===null?'—':S(r.xpHour),'Janela de hunt ativa','sd-blue','⚡')}${card('Abates / hora',r.killsHour===null?'—':F(r.killsHour),'Ritmo de combate','sd-purple','⚔')}${card('Abates totais',F(t.kills),'Sessão atual','sd-greenish','◎')}</div>
    ${composition}
    ${sectionShown('huntLoot')?`<div class="sd-panelcard"><div class="sd-flex"><h4>🎒 Loot da sessão</h4><span class="sd-pill">${loot.length} itens</span></div>${loot.length?loot.slice(0,state.lootExpanded?50:5).map(([n,q])=>`<div class="sd-split"><span>${E(n)}</span><b>×${F(q)}</b></div>`).join(''):empty('Nenhum loot contabilizado.')}${buttonMore('show-more-loot',state.lootExpanded,loot.length,5)}</div>`:''}
    ${calculator}</section>`;
  }
  function captures(){const t=stats(),groups={};for(const c of state.catches){const key=c.ball||'Poké Ball';groups[key]??={tries:0,wins:0};groups[key].tries++;if(c.success)groups[key].wins++;}
    const recent=state.catches.slice(0,state.catchesExpanded?50:5);
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">SEUS RESULTADOS</span><h3>◈ Analisador de capturas</h3></div><button class="sd-ghost sd-xs" data-action="export-catches">↓ CSV</button></div>
    <div class="sd-metrics">${card('Tentativas',F(t.attempts),'Até 400 registros','sd-blue','◎')}${card('Capturas',F(t.wins),'Pokémon capturados','sd-greenish','✓')}${card('Taxa de captura',F(t.rate,1)+'%','Sucessos / tentativas','sd-accent','◈')}${card('Falhas',F(t.attempts-t.wins),'Tentativas sem sucesso','sd-purple','×')}</div>
    ${sectionShown('capturesBalls')?`<div class="sd-panelcard"><div class="sd-section-head"><h4>◉ Resultados por Poké Bola</h4><button class="sd-ghost sd-xs" data-action="clear-catches">Limpar</button></div>${Object.keys(groups).length?Object.entries(groups).sort((a,b)=>b[1].tries-a[1].tries).map(([name,g])=>`<div class="sd-ball"><div class="sd-flex"><b>${E(name)}</b><small>${g.wins}/${g.tries} · ${F(g.wins/g.tries*100,1)}%</small></div><div class="sd-track"><i style="width:${g.wins/g.tries*100}%"></i></div></div>`).join(''):empty('Aguardando os resultados de capturas.')}</div>`:''}
    ${sectionShown('capturesRecent')?`<div class="sd-panelcard"><div class="sd-section-head"><h4>⌁ Últimas tentativas</h4><span class="sd-pill">${Math.min(state.catches.length,50)} mais recentes</span></div>${recent.length?recent.map(captureHtml).join(''):empty('Ainda não foram registradas tentativas.')}${buttonMore('show-more-catches',state.catchesExpanded,Math.min(state.catches.length,50),5)}</div>`:''}</section>`;
  }
  function shiny(){return `<section class="sd-stack"><div class="sd-section-head"><h3>Radar de Shiny</h3><span class="sd-pill sd-gold">✦ Monitoramento</span></div>
     <div class="sd-shiny-hero"><div>✦</div><strong>${F(state.shinyLog.length)}</strong><span>avistamentos registrados</span></div>
     ${sectionShown('shinyDetector')?`<div class="sd-panelcard"><div class="sd-flex"><div><h4>Detector de Shinies</h4><p>Observa os eventos recebidos do mapa.</p></div><label class="sd-toggle"><input type="checkbox" data-pref="shiny" ${state.prefs.shiny?'checked':''}><span></span></label></div><div class="sd-flex sd-margin"><div><h4>Alerta sonoro original</h4><p>Som sintetizado localmente, sem arquivos externos.</p></div><label class="sd-toggle"><input type="checkbox" data-pref="sound" ${state.prefs.sound?'checked':''}><span></span></label></div></div>`:''}
     ${sectionShown('shinyHistory')?`<div class="sd-section-head"><h3>Histórico de encontros</h3><button class="sd-ghost sd-xs" data-action="clear-shiny">Limpar histórico</button></div>
     ${state.shinyLog.length?state.shinyLog.slice(0,state.shinyExpanded?50:5).map(s=>`<div class="sd-event sd-shinyevent"><span class="sd-event-icon">✦</span><span><b>${E(s.name)}</b><small> · ${E(s.position)}</small></span><time>${formatDate(s.t)}</time></div>`).join(''):empty('Nenhum Shiny visto desde a instalação.','✦')}${buttonMore('show-more-shinies',state.shinyExpanded,Math.min(state.shinyLog.length,50),5)}`:''}
    </section>`;}
  function settings(){
    const order=state.prefs.tabOrder.filter(id=>OPTIONAL_TABS.includes(id));
    const tabs=order.map((id,i)=>{const [_,title,ico]=TAB_META.find(row=>row[0]===id);return `<div class="sd-order-row"><span class="sd-order-icon">${ico}</span><span class="sd-grow">${E(title)}</span><label class="sd-toggle"><input type="checkbox" data-tab-visible="${id}" ${state.prefs.tabVisible[id]!==false?'checked':''} aria-label="Exibir ${E(title)}"><span></span></label><button data-action="tab-up" data-value="${id}" title="Mover para cima" ${i===0?'disabled':''}>↑</button><button data-action="tab-down" data-value="${id}" title="Mover para baixo" ${i===order.length-1?'disabled':''}>↓</button></div>`;}).join('');
    const boxes=Object.entries(SECTIONS).map(([id,fields])=>{const title=TAB_META.find(row=>row[0]===id)?.[1]||id;return `<div class="sd-options-group"><h4>${E(title)}</h4>${fields.map(([key,label])=>`<label class="sd-opt-row"><input type="checkbox" data-section-visible="${E(key)}" ${sectionShown(key)?'checked':''}><span>${E(label)}</span></label>`).join('')}</div>`;}).join('');
    return `<section class="sd-stack"><div class="sd-section-head sd-top-title"><div><span class="sd-eyebrow">PERSONALIZE DO SEU JEITO</span><h3>⚙ Central de ajustes</h3></div><span class="sd-pill sd-gold">✓ Salvo</span></div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">◫</span><div><h4>Organizar abas</h4><p>Mostre, esconda e reorganize com as setas.</p></div></div>${tabs}<p class="sd-note">A área Ajustes permanece disponível para você reorganizar o painel quando quiser.</p></div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">✧</span><div><h4>Visibilidade dos módulos</h4><p>Escolha exatamente quais blocos aparecem em cada aba.</p></div></div>${boxes}</div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">◉</span><div><h4>Experiência da Pokédex</h4><p>Leitura e abertura do painel personalizáveis.</p></div></div>${toggle('enabled','Reconhecer Pokémon','Identificar fichas ao passar o mouse')}${toggle('autoPokemon','Abrir Pokédex automaticamente','Mostra a ficha dentro do Community Dex ao passar o mouse')}${toggle('toasts','Avisos na tela','Alertas visuais para eventos importantes')}</div>
    <div class="sd-panelcard"><div class="sd-card-heading"><span class="sd-section-icon">◈</span><div><h4>Aparência</h4><p>Configurações do seu painel.</p></div></div>${toggle('compact','Modo compacto','Painel mais estreito, com menos espaço')}
    <div class="sd-miniheading">Opacidade do painel · <output id="sd-opacity-label">${state.prefs.opacity}%</output></div><input type="range" min="75" max="100" step="1" value="${state.prefs.opacity}" id="sd-opacity-slider"></div>
    <div class="sd-panelcard"><h4>✦ Precisão do cálculo de IV</h4><p>Selecione o limite individual usado nas estimativas.</p><div class="sd-segments"><button class="sd-segment ${state.prefs.ivMax===31?'active':''}" data-action="max-iv" data-value="31">31 IV</button><button class="sd-segment ${state.prefs.ivMax===32?'active':''}" data-action="max-iv" data-value="32">32 IV</button></div></div>
    <div class="sd-panelcard"><div class="sd-flex"><div><h4>↻ Restaurar preferências</h4><p>Reorganiza a interface sem apagar as estatísticas.</p></div><button class="sd-ghost sd-xs" data-action="reset-preferences">Restaurar</button></div></div>
    <div class="sd-credit">COMMUNITY DEX · v1.1.0</div></section>`;
  }
  const toggle=(key,label,sub)=>`<div class="sd-flex sd-pref"><div><h4>${E(label)}</h4><p>${E(sub)}</p></div><label class="sd-toggle"><input type="checkbox" data-pref="${E(key)}" ${state.prefs[key]?'checked':''}><span></span></label></div>`;
  const TABS=TAB_META;
  const screens={overview,pokemon,hunt,captures,shiny,settings};
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
    panel=document.createElement('div');panel.id='sd-panel';panel.innerHTML=`<header id="sd-titlebar"><div class="sd-brand"><div class="sd-brand-mark"><img class="sd-brand-logo" src="${E(logo)}" alt="" draggable="false"></div><div><strong>COMMUNITY <em>DEX</em></strong><span>SEU COMPANHEIRO POKÉMON</span></div></div><div class="sd-header-actions"><button id="sd-min" title="Minimizar">−</button><button id="sd-close" title="Fechar">×</button></div></header><div id="sd-statusbar"></div><nav id="sd-nav"></nav><main id="sd-body"></main><footer id="sd-footer"><span>ALT + P · Painel</span><span>Versão v1.1.0</span></footer>`;
    alertBox=document.createElement('div');alertBox.id='sd-alerts';
    host.append(dock,panel,alertBox);
    body=panel.querySelector('#sd-body');
    panel.querySelector('#sd-close').addEventListener('click',()=>{state.open=false;render();});
    panel.querySelector('#sd-min').addEventListener('click',()=>{state.min=!state.min;render();});
    panel.querySelector('#sd-nav').addEventListener('click',ev=>{const b=ev.target.closest('[data-tab]');if(!b)return;state.tab=b.dataset.tab;body.scrollTop=0;render();});
    panel.addEventListener('click',onAction);
    panel.addEventListener('error',ev=>{if(ev.target?.matches?.('.sd-artwork'))ev.target.hidden=true;},true);
    panel.addEventListener('change',onChange);
    panel.addEventListener('input',onInput);
    panel.querySelector('#sd-titlebar').addEventListener('pointerdown',beginDrag);
    window.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.code==='KeyP'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();state.open=!state.open;render();}});
    window.addEventListener('resize',()=>{if(state.pos)applyPos();applyDockPos();});
    applyDockPos();
    render();
  }
  function startDockDrag(ev){
    if(ev.button!==0)return;
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
    if(!dock||!state.dockPos)return;
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
  function moveDrag(ev){if(!drag)return;state.pos={x:Math.max(6,Math.min(innerWidth-panel.offsetWidth-6,drag.left+ev.clientX-drag.x)),y:Math.max(6,Math.min(innerHeight-70,drag.top+ev.clientY-drag.y))};applyPos();}
  function stopDrag(){drag=null;panel.removeEventListener('pointermove',moveDrag);persist();}
  function applyPos(){if(!state.pos)return;panel.style.left=Math.max(6,Math.min(Math.max(6,innerWidth-panel.offsetWidth-6),state.pos.x))+'px';panel.style.top=Math.max(6,Math.min(Math.max(6,innerHeight-70),state.pos.y))+'px';panel.style.right='auto';panel.style.bottom='auto';}
  function render(){
    if(!host)return;
    host.dataset.compact=String(state.prefs.compact);
    panel.style.setProperty('--sd-alpha',String(state.prefs.opacity/100));
    panel.hidden=!state.open;
    panel.classList.toggle('sd-minimized',state.min);
    dock.querySelector('#sd-dock-count').textContent=state.shinyLog.length?String(state.shinyLog.length):'';
    dock.classList.remove('sd-hide');
    if(!activeTabs().includes(state.tab))state.tab=activeTabs()[0]||'settings';
    panel.querySelector('#sd-statusbar').innerHTML=`<span class="sd-live-dot ${status()==='Conectado'?'sd-connected':''}"></span> ${E(status())} ${state.pokemon?`<span class="sd-status-right">${E(state.pokemon.name)}</span>`:`<a class="sd-hub-status" href="https://stigalzera.com/" target="_blank" rel="noopener noreferrer">✦ Community Hub ↗</a>`}`;
    const nav=panel.querySelector('#sd-nav');const navScroll=nav.scrollLeft;
    nav.innerHTML=activeTabs().map(id=>{const [_,title,icon]=TABS.find(tab=>tab[0]===id);return `<button type="button" data-tab="${id}" class="${state.tab===id?'selected':''}" title="${title}"><span>${icon}</span><small>${title}</small></button>`;}).join('');nav.scrollLeft=navScroll;
    if(state.open&&!state.min&&screens[state.tab]){
      // Do not replace focused inputs while users are typing.
      const focused=body.contains(document.activeElement)&&['INPUT','TEXTAREA'].includes(document.activeElement.tagName);
      if(!focused){const top=body.scrollTop;body.innerHTML=screens[state.tab]();body.scrollTop=top;}
    }
    if(state.pos)applyPos();
    applyDockPos();
  }
  function onInput(ev){
    const target=ev.target;
    if(target?.id==='sd-tooltip-input')state.manualText=target.value;
    if(target?.dataset.filterInput){const term=C.text(target.value,80).toLowerCase();for(const row of body.querySelectorAll('[data-filter]'))row.hidden=term&&!row.dataset.filter.includes(term);}
    if(target?.id==='sd-opacity-slider'){state.prefs.opacity=Number(target.value);panel.style.setProperty('--sd-alpha',String(state.prefs.opacity/100));const out=body.querySelector('#sd-opacity-label');if(out)out.textContent=state.prefs.opacity+'%';persist();}
  }
  function onChange(ev){
    const target=ev.target;const pref=target?.dataset?.pref;
    if(pref&&pref in PREF&&typeof PREF[pref]==='boolean'){state.prefs[pref]=target.checked;persist();scheduleRender();return;}
    if(target?.dataset?.tabVisible){const id=target.dataset.tabVisible;if(!OPTIONAL_TABS.includes(id))return;state.prefs.tabVisible[id]=target.checked;persist();scheduleRender();return;}
    if(target?.dataset?.sectionVisible){const id=target.dataset.sectionVisible;if(!(id in DEFAULT_SECTIONS))return;state.prefs.sectionVisible[id]=target.checked;persist();scheduleRender();}
  }
  function onAction(event){
    const btn=event.target.closest('button[data-action]');if(!btn)return;
    const action=btn.dataset.action;
    if(action==='toggle-section'){const key=btn.dataset.section;if(!['pokemonManual','huntComposition','huntCalculator'].includes(key))return;state.prefs.expanded[key]=!state.prefs.expanded[key];persist();render();}
    else if(action==='show-more-activity'){state.activityExpanded=!state.activityExpanded;render();}
    else if(action==='show-more-catches'){state.catchesExpanded=!state.catchesExpanded;render();}
    else if(action==='show-more-history'){state.historyExpanded=!state.historyExpanded;render();}
    else if(action==='show-more-loot'){state.lootExpanded=!state.lootExpanded;render();}
    else if(action==='show-more-shinies'){state.shinyExpanded=!state.shinyExpanded;render();}
    else if(action==='tab-up'||action==='tab-down'){
      const order=state.prefs.tabOrder,id=btn.dataset.value,i=order.indexOf(id),to=i+(action==='tab-up'?-1:1);
      if(i>=0&&to>=0&&to<order.length){[order[i],order[to]]=[order[to],order[i]];persist();render();}
    }
    else if(action==='reset-overview'){
      if(!confirm('Zerar estatísticas de capturas, Shinies, hunt e atividades recentes? Suas preferências e fichas da Pokédex serão mantidas.'))return;
      state.catches=[];state.shinyLog=[];state.shiniesSeen.clear();state.kills=[];state.totalXp=null;state.level=null;state.parts={};state.loot={};state.feed=[];
      state.activityExpanded=false;state.catchesExpanded=false;state.lootExpanded=false;state.shinyExpanded=false;
      persist();render();
    }
    else if(action==='reset-preferences'){state.prefs=structuredClone(PREF);persist();render();}
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
    else if(action==='reset-hunt'){if(!confirm('Zerar os dados da hunt atual?'))return;state.kills=[];state.parts={};state.loot={};state.totalXp=null;state.level=null;persist();render();}
    else if(action==='clear-catches'){if(!confirm('Apagar o histórico de capturas?'))return;state.catches=[];persist();render();}
    else if(action==='clear-shiny'){if(!confirm('Apagar o histórico de Shinies?'))return;state.shinyLog=[];state.shiniesSeen.clear();persist();render();}
    else if(action==='max-iv'){state.prefs.ivMax=Number(btn.dataset.value)===31?31:32;persist();render();}
    else if(action==='calculate-xp'){
      const current=Math.floor(Number(body.querySelector('#sd-xp-from')?.value)||1),target=Math.floor(Number(body.querySelector('#sd-xp-to')?.value)||1);
      const out=body.querySelector('#sd-xp-result');if(!out)return;
      if(current<1||target<=current||target>10000){out.textContent='Informe um nível alvo maior que o atual, até 10.000.';return;}
      out.textContent='Do nível '+F(current)+' até '+F(target)+': '+F(C.xpForLevel(target)-C.xpForLevel(current))+' XP acumulada.';
      state.huntTarget=target;persist();
    }
    else if(action==='export-catches'){const head=['data','pokemon','ball','capturado','shiny','automatico'];const lines=state.catches.map(c=>[new Date(c.t).toISOString(),c.name,c.ball,c.success,c.shiny,c.auto].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));download('community-dex-capturas.csv','\ufeff'+[head.join(','),...lines].join('\r\n'),'text/csv;charset=utf-8');}

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
  async function init(){
    try{
      const stored=await chrome.storage.local.get([STORE,LEGACY_STORE]);const saved=stored[STORE]||stored[LEGACY_STORE]||{};
      const pv=saved.prefs||{};state.prefs={...structuredClone(PREF),...pv,tabVisible:{...PREF.tabVisible,...(pv.tabVisible||{})},sectionVisible:{...PREF.sectionVisible,...(pv.sectionVisible||{})},expanded:{...PREF.expanded,...(pv.expanded||{})}};
      state.prefs.tabOrder=[...new Set([...(Array.isArray(pv.tabOrder)?pv.tabOrder:[]),...OPTIONAL_TABS])].filter(id=>OPTIONAL_TABS.includes(id));
      state.pinned=saved.pinned||null;
      for(const key of ['history','catches','shinyLog'])if(Array.isArray(saved[key]))state[key]=saved[key].slice(0,key==='catches'?400:120);
      state.pos=saved.pos||null;state.dockPos=saved.dockPos||null;state.huntTarget=saved.huntTarget||150;state.pokeTarget=saved.pokeTarget||100;
      try{const hunt=JSON.parse(sessionStorage.getItem(STORE+':hunt')||sessionStorage.getItem(LEGACY_STORE+':hunt')||'null');if(hunt){state.kills=Array.isArray(hunt.kills)?hunt.kills.slice(-1000):[];state.parts=hunt.parts||{};state.loot=hunt.loot||{};state.totalXp=hunt.totalXp;state.level=hunt.level;}}catch{}
    }catch{}
    const ready=()=>{if(!document.body){document.addEventListener('DOMContentLoaded',ready,{once:true});return;}construct();initObserver();};
    ready();
  }
  init();
})();
