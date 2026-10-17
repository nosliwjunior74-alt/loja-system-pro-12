(()=>{
'use strict';
// D8A: interface isolada. Somente gera rascunhos textuais depois de clique e confirmacao.
const $=id=>document.getElementById(id);
const names={coordenador:'Coordenador',estrategia:'Estratégia',redacao:'Redação',design:'Design (briefing)',video:'Vídeo (roteiro)',conformidade:'Conformidade',publicacao:'Publicação (plano)',analise:'Análise (plano)'};
const area=$('ppD8AI'), select=$('ppD8Agent'), info=$('ppD8Status'), results=$('ppD8Results'), generate=$('ppD8Generate');
if(!area||!select||!info||!results||!generate)return;
for(const [id,label] of Object.entries(names)){const opt=document.createElement('option');opt.value=id;opt.textContent=label;select.append(opt)}
const cur=()=>window.PPD8CurrentCampaign?.()||null;
const url=state=>'/api/campanha-unificada/v1/'+encodeURIComponent(state.type)+'/'+encodeURIComponent(state.selectedId)+'/d8';
const query=state=>state.loja?'?loja='+encodeURIComponent(state.loja):'';
const text=(node,msg)=>{node.textContent=String(msg)};
let busy=false,currentKey='';
function disable(msg){generate.disabled=true;if(msg)text(info,msg)}
function draw(items){results.replaceChildren();if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent='Nenhuma geracao D8 neste rascunho.';results.append(p);return}
  for(const r of items){const d=document.createElement('article');d.className='pp-d8-result';const h=document.createElement('strong');h.textContent=names[r.agent]||r.agent;const stamp=document.createElement('small');stamp.textContent=' · '+new Date(r.createdAt).toLocaleString('pt-BR')+' · '+r.status;const p=document.createElement('pre');p.textContent=r.status==='concluido'?r.answer:'Solicitacao registrada sem texto final.';d.append(h,stamp,p);results.append(d)}
}
async function getStatus(s){const res=await fetch(url(s)+'/status'+query(s),{credentials:'same-origin',cache:'no-store'});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw Error(data.error||'HTTP '+res.status);return data}
async function refresh(){if(busy)return;const s=cur();disable('Carregando limites D8…');currentKey='';results.replaceChildren();
 if(!s||!s.selectedId||s.dirty){disable('Salve e selecione uma campanha antes de usar a IA. Alteracoes nao salvas nao entram no texto.');return}
 const key=s.type+'::'+s.selectedId+'::'+s.loja;
 try{const data=await getStatus(s);const latest=cur();if(!latest||key!==latest.type+'::'+latest.selectedId+'::'+latest.loja||latest.dirty)return;
   currentKey=key;const remaining=Math.max(0,data.monthlyLimit-data.monthlyUsed),gRemaining=Math.max(0,data.globalMonthlyLimit-data.globalMonthlyUsed);
   const enabled=data.enabled&&remaining>0&&gRemaining>0;
   text(info,(enabled?'IA habilitada para testes controlados. ':'IA desativada ou sem cotas. ')+`Cota deste ambiente: ${data.monthlyUsed}/${data.monthlyLimit}; cota geral: ${data.globalMonthlyUsed}/${data.globalMonthlyLimit}. Nenhuma publicacao automatica.`);
   generate.disabled=!enabled||data.agentEnabled?.[select.value]===false;select.querySelectorAll('option').forEach(opt=>{opt.disabled=data.agentEnabled?.[opt.value]===false});draw(data.results||[]);
 }catch(e){disable('Nao foi possivel consultar o D8: '+e.message)}
}
area.addEventListener('toggle',()=>{if(area.open)refresh()});
$('ppD8Refresh').addEventListener('click',refresh);
select.addEventListener('change',()=>{if(area.open)refresh()});
generate.addEventListener('click',async()=>{
 if(busy)return;const s=cur();if(!s||!s.selectedId||s.dirty)return disable('Salve a campanha primeiro.');
 const key=s.type+'::'+s.selectedId+'::'+s.loja;if(key!==currentKey)return refresh();
 const agent=select.value;if(!names[agent])return;
 if(!confirm('GERACAO DE IA PAGA: deseja solicitar UMA resposta do agente '+names[agent]+'? Isso pode consumir creditos da sua conta OpenAI. Nao sera publicado nada.'))return;
 busy=true;generate.disabled=true;text(info,'Consultando IA. Aguarde; nao feche a pagina.');
 try{const res=await fetch(url(s)+'/gerar'+query(s),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','x-pp-d8-action':'1'},body:JSON.stringify({agent,confirmarCusto:true})});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw Error(data.error||'HTTP '+res.status);
   text(info,'Texto gerado e salvo como RASCUNHO. Revise antes de utilizar. Nada foi publicado.');
 }catch(e){text(info,'D8: '+e.message+' (a reserva de cota pode ter sido contabilizada).')}
 finally{busy=false;await refresh()}
});
})();
