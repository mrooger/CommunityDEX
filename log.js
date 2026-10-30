'use strict';
(async()=>{
  const content=document.getElementById('content');
  const button=document.getElementById('download');
  const params=new URLSearchParams(location.search);
  const kind=params.get('kind'),id=params.get('id');
  const fmt=n=>Math.round(Number(n)||0).toLocaleString('pt-BR');
  const date=t=>new Date(t).toLocaleString('pt-BR',{dateStyle:'medium',timeStyle:'short'});
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
  const add=(parent,tag,cls,text)=>{const node=el(tag,cls,text);parent.append(node);return node;};
  try{
    if(!['daily','manual'].includes(kind)||!/^((daily|manual)-\d+-\d+)(?:-[a-f0-9]{8,24})?$/.test(id||''))throw Error('Registro inválido');
    const data=await chrome.storage.local.get('community-dex:v1');const state=data['community-dex:v1']||{};
    const report=(kind==='daily'?(state.dailyLogs||[]):(state.manualLogs||[])).find(item=>item.id===id);
    if(!report)throw Error('LOG não encontrado. Ele pode ter sido excluído ou expirado.');
    content.replaceChildren();
    const lead=add(content,'section','lead');add(lead,'div','over',kind==='daily'?'LOG DIÁRIO · 24 HORAS':'LOG MANUAL · RESUMO SALVO');
    add(lead,'h2','',date(report.startAt)+' — '+date(report.endAt));
    const duration=report.endAt-report.startAt;const durationLabel=duration<3600000?Math.max(0,Math.floor(duration/60000))+' min':(duration/3600000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' horas';add(lead,'p','',`Tempo registrado: ${durationLabel} · Médias calculadas sobre o período do LOG`);
    if(report.partial)add(lead,'p','notice','Registro migrado de uma versão anterior: os totais podem estar incompletos.');
    const metrics=add(content,'section','metrics');const s=report.summary||{};
    for(const [name,value,sub,accent] of [
      ['XP da sessão',fmt(s.xp),'Experiência acumulada',true],['XP por hora',fmt(s.xpHour),'Média do período'],
      ['Abates por hora',fmt(s.killsHour),'Média do período'],['Abates totais',fmt(s.kills),'Total registrado'],
      ['Shinies encontrados',fmt(s.shinyEncounters),'Aparições únicas',true],['Capturas',fmt(s.captures),'Capturas bem-sucedidas'],
      ['Capturas normais',fmt(s.normalCaptures),'Sem Shiny'],['Capturas Shiny',fmt(s.shinyCaptures),'Capturas especiais',true]]){
      const card=add(metrics,'div','metric'+(accent?' accent':''));add(card,'span','',name);add(card,'b','',value);add(card,'small','',sub);
    }
    if(report.bestCapture){
      const c=report.bestCapture;const feature=add(content,'section','card');add(feature,'h3','','♛ Melhor captura');
      add(feature,'strong','',c.name||'Pokémon');
      add(feature,'p','',`${c.rarity||'Raridade não informada'}${c.quality!=null?' · ×'+c.quality:''}${c.ivTotal!=null?' · IV '+c.ivTotal+'/192':''}${c.power!=null?' · Poder '+c.power:''}`);
    }
    const grid=add(content,'div','grid');
    const shinyCard=add(grid,'section','card');add(shinyCard,'h3','','✦ Histórico de Shinies');
    if(!report.shinies?.length)add(shinyCard,'p','empty','Nenhum encontro registrado.');
    for(const shiny of (report.shinies||[]).slice(0,200)){const line=add(shinyCard,'div','listRow');const label=add(line,'div');add(label,'strong','',shiny.name||'Shiny');if(shiny.position)add(label,'small','',String(shiny.position));add(line,'time','',date(shiny.t));}
    const capCard=add(grid,'section','card');add(capCard,'h3','','◈ Capturas bem-sucedidas');
    if(!report.captures?.length)add(capCard,'p','empty','Nenhuma captura registrada.');
    for(const c of (report.captures||[]).slice(0,200)){const line=add(capCard,'div','listRow');const desc=add(line,'div');add(desc,'strong','',c.name||'Pokémon');add(desc,'small','',`${c.ball||'Poké Ball'} · ${c.rarity||'Raridade não informada'} · IV ${c.ivTotal??'—'}`);const right=add(line,'div');if(c.shiny)add(right,'span','tag','✦ Shiny');add(right,'time','',date(c.t));}
    const foot=add(grid,'section','card');add(foot,'h3','','⚡ XP por origem');const names={vip:'Bônus VIP',base:'XP base',stream:'Bônus Stream',twitch:'Bônus Twitch',boost:'Bônus XP',typeDay:'Bônus tipo do dia',event:'Bônus de evento',streak:'Bônus de sequência'};const parts=Object.entries(report.parts||{}).filter(([,v])=>Number(v)>0).sort((a,b)=>b[1]-a[1]);
    if(!parts.length)add(foot,'p','empty','Sem dados detalhados de XP.');
    for(const [key,value] of parts){const line=add(foot,'div','listRow');add(line,'strong','',names[key]||key);const rate=key!=='base'&&Number(report.parts.base)>0?' · +'+(Math.round(1000*value/report.parts.base)/10)+'%':' ';add(line,'span','',fmt(value)+' XP'+rate);}
    const loot=add(grid,'section','card');add(loot,'h3','','🎒 Loot');const entries=Object.entries(report.loot||{}).sort((a,b)=>b[1]-a[1]);if(!entries.length)add(loot,'p','empty','Nenhum loot registrado.');for(const [name,q] of entries){const line=add(loot,'div','listRow');add(line,'strong','',name);add(line,'span','',`×${fmt(q)}`);}
    button.hidden=false;button.addEventListener('click',()=>{const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`Community-LOG-${kind}-${new Date(report.startAt).toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);});
  }catch(error){content.replaceChildren(add(document.createDocumentFragment(),'p','empty',error.message||'Não foi possível carregar o LOG.'));}
})();
