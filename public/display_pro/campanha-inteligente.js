(()=>{
'use strict';
// Provador Pro D5 V1: somente rascunhos + configuracoes D3 + previa D4.
// Nenhum envio externo, publicacao, agendamento ou modelo IA e executado.
const qp=new URLSearchParams(location.search);
const isStore=qp.get('context')==='loja';
const TYPES=Object.freeze({central_produtor:'Central de Comunicados',vendas_produtor:'Vendas do Provador Pro',vendas_lojista:'Campanhas da Loja'});
const CHANNELS=Object.freeze({carrossel:'Carrossel interno',instagram:'Instagram',facebook:'Facebook',whatsapp:'WhatsApp Business',tiktok:'TikTok',google_business:'Perfil da Empresa no Google'});
const AGENTS=Object.freeze({coordenador:'Coordenador',estrategia:'Estratégia',redacao:'Redação',design:'Design',video:'Vídeo',conformidade:'Conformidade',publicacao:'Publicação',analise:'Análise'});
const $=id=>document.getElementById(id);
let type=isStore?'vendas_lojista':qp.get('app')==='central_produtor'?'central_produtor':'vendas_produtor';
let items=[],selectedId=null,profile=null,previewResult=null,dirty=false,contextVersion=0,busy=false;
const api=()=>`/api/campanha-unificada/v1/${type}`;
// D8A fornece somente a selecao atual, sem expor dados ou alterar o editor D5.
window.PPD8CurrentCampaign=()=>({type,selectedId,dirty,loja:qp.get('loja')||''});
const setText=(id,value)=>{$(id).textContent=String(value??'')};
function status(message,kind=''){
  const e=$('status'); e.textContent=message;e.className='status'+(kind?' '+kind:'');
}
function profileStatus(s){setText('profile-status',s)}
function setBusy(v){busy=v;for(const id of ['save','save-preview','refresh','new','save-profile','reload-profile'])$(id).disabled=v;for(const b of document.querySelectorAll('button[data-type]'))b.disabled=v;window.PPAdGuideD6?.setBusy(v);}
async function request(path,options={}){
 const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 let data;try{data=await res.json()}catch(_){throw Error(`Resposta inválida do servidor (HTTP ${res.status}).`)}
 if(!res.ok||!data||data.ok===false||data.error)throw Error(data?.error||`HTTP ${res.status}`);
 return data;
}
function bodyJson(obj){return {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}}
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e}
function showEmpty(target,message){const box=$(target);box.replaceChildren(el('div','empty',message))}
function clearPreview(){previewResult=null;setText('preview-version','Sem prévia');setText('preview-info','Salve um rascunho para visualizar os materiais por canal.');showEmpty('preview','Nenhuma prévia gerada.');$('warnings').replaceChildren();$('preview-again').disabled=true;$('export').disabled=true;}
function formFields(){return ['title','objective','subject','offer','audience','cta'].map(id=>$(id))}
function markDirty(){dirty=true;clearPreview()}
function allowChannels(){return type==='central_produtor'?['carrossel']:['instagram','facebook','whatsapp','tiktok','google_business']}
function channelChoices(selected=[]){const box=$('channels');box.replaceChildren();for(const k of allowChannels()){
 const label=el('label','choice');const input=document.createElement('input');input.type='checkbox';input.value=k;input.checked=selected.includes(k);input.addEventListener('change',markDirty);label.append(input,document.createTextNode(CHANNELS[k]));box.append(label);
}}
function setupContext(){
 const tabs=$('tabs');tabs.classList.toggle('hide',isStore);
 for(const b of tabs.querySelectorAll('button[data-type]'))b.setAttribute('aria-selected',String(b.dataset.type===type));
 setText('mode',isStore?'LOJISTA · CAMPANHAS DA SUA LOJA':'PRODUTOR · '+TYPES[type].toUpperCase());
 setText('heading',TYPES[type]);
 setText('intro',type==='central_produtor'?'Prepare comunicados internos para lojistas. O carrossel atual V1.15 permanece separado e não é ativado por esta tela.':type==='vendas_produtor'?'Prepare materiais para divulgar planos, assinaturas e módulos do Provador Pro.':'Prepare campanhas de roupas, looks e coleções vinculadas somente à sua loja.');
 const storeSlug=qp.get('loja')||'';
 $('back').href=isStore?'/dashboard-loja.html'+(storeSlug?'?loja='+encodeURIComponent(storeSlug):''):'/lojas_master.html';
 // Se o aplicativo estiver no iframe do painel, voltar na janela principal.
 $('back').target='_top';
 window.PPAdGuideD6?.setContext(type);
}
function defaultChannels(){return type==='central_produtor'?['carrossel']:['instagram']}
function resetForm(){selectedId=null;dirty=false;for(const field of formFields())field.value='';setText('edit-state','Novo rascunho');channelChoices(defaultChannels());window.PPAdGuideD6?.reset();clearPreview();renderList();}
function editItem(item){
 selectedId=item.id;dirty=false;
 const brief=item.campaignBrief||{};
 $('title').value=item.title||'';$('objective').value=item.objective||'';$('subject').value=item.subject||'';
 $('offer').value=brief.offer||'';$('audience').value=brief.audience||'';$('cta').value=brief.callToAction||'';
 channelChoices(item.channels||[]);window.PPAdGuideD6?.load(brief.adGuide);setText('edit-state',item.state||'rascunho');clearPreview();renderList();
}
function renderList(){const box=$('campaign-list');box.replaceChildren();setText('count',items.length);
 if(!items.length){box.append(el('div','empty','Nenhum rascunho neste aplicativo. Clique em + Nova.'));return}
 for(const item of [...items].reverse()){
  const button=el('button','item'+(item.id===selectedId?' active':''));button.type='button';button.append(el('strong','',item.title||'Sem título'));
  const date=item.updatedAt?new Date(item.updatedAt):null;
  const dateText=date&&!Number.isNaN(+date)?date.toLocaleString('pt-BR'):'';
  button.append(el('small','',`${item.state||'rascunho'} · ${dateText}`));
  button.addEventListener('click',()=>{if(busy)return;if(dirty&&!confirm('Descartar alterações ainda não salvas?'))return;editItem(item);loadPreview(item.id)});
  box.append(button);
 }
}
function populateAgents(){const box=$('agents');box.replaceChildren();for(const [key,label] of Object.entries(AGENTS)){
 const cfg=profile?.agents?.[key]||{enabled:true,instructions:''};
 const card=el('div','agent');const checkLabel=el('label');
 const check=document.createElement('input');check.type='checkbox';check.checked=cfg.enabled!==false;check.dataset.agentEnabled=key;
 checkLabel.append(check,document.createTextNode(label));
 const instructions=document.createElement('textarea');instructions.maxLength=800;instructions.rows=3;instructions.placeholder='Instruções deste agente (opcional)';instructions.value=cfg.instructions||'';instructions.dataset.agentInstructions=key;
 card.append(checkLabel,instructions);box.append(card);
}}
function loadProfileIntoForm(){if(!profile)return;
 $('profile-objective').value=profile.objective||'';$('profile-audience').value=profile.audience||'';
 $('profile-tone').value=profile.tone||'';$('profile-instructions').value=profile.instructions||'';populateAgents();
}
async function refreshList(v=contextVersion){
 const r=await request(api());if(v!==contextVersion)return;
 items=r.items||[];if(!Array.isArray(items))throw Error('Formato de listagem inválido');
 if(selectedId){const item=items.find(x=>x.id===selectedId);if(item)editItem(item);else resetForm()}else renderList();
}
async function reloadProfile(v=contextVersion){const r=await request(api()+'/configuracao-ia');if(v!==contextVersion)return;
 if(r.type!==type)throw Error('Contexto inesperado na configuração dos agentes');
 profile=r.profile;loadProfileIntoForm();profileStatus(r.updatedAt?'Perfil carregado. Última alteração registrada.':'Perfil padrão carregado; ainda não foi personalizado.');
}
async function switchContext(target){
 if(!Object.hasOwn(TYPES,target))return;
 if(isStore&&target!=='vendas_lojista')return;
 if(busy)return;
 if(dirty&&!confirm('Descartar alterações ainda não salvas?'))return;
 const v=++contextVersion;type=target;items=[];profile=null;selectedId=null;dirty=false;
 setupContext();resetForm();setText('count','0');showEmpty('campaign-list','Carregando…');profileStatus('Carregando configurações…');setBusy(true);status('Consultando sua sessão e os dados deste aplicativo…');
 try{
  await Promise.all([refreshList(v),reloadProfile(v)]);if(v===contextVersion)status(`Aplicativo ${TYPES[type]} carregado. ${items.length} campanha(s) encontrada(s).`,'success');
 }catch(e){if(v===contextVersion){status(`Não foi possível acessar este aplicativo: ${e.message}. Confirme o login correto no painel.`, 'error');showEmpty('campaign-list','Não foi possível carregar as campanhas.');}}
 finally{if(v===contextVersion)setBusy(false)}
}
function buildPayload(){
 const title=$('title').value.trim(),objective=$('objective').value.trim();
 if(!title||!objective)throw Error('Informe título e objetivo antes de salvar.');
 const channels=[...$('channels').querySelectorAll('input:checked')].map(x=>x.value);
 if(!channels.length)throw Error('Selecione ao menos um canal.');
 const previous=items.find(x=>x.id===selectedId);
 return {title,objective,subject:$('subject').value.trim(),channels,
   campaignBrief:{...(previous?.campaignBrief||{}),offer:$('offer').value.trim(),audience:$('audience').value.trim(),callToAction:$('cta').value.trim(),...window.PPAdGuideD6?.campaignBriefFields(previous?.campaignBrief?.adGuide)}};
}
async function saveCampaign(alsoPreview){if(busy)return;const app=type,v=contextVersion;let payload;
 try{payload=buildPayload()}catch(e){status(e.message,'error');return}
 setBusy(true);status('Salvando o rascunho no servidor…');
 try{
  const wasNew=!selectedId;
  const path=api()+(selectedId?'/'+encodeURIComponent(selectedId):'');
  const opts=selectedId?bodyJson(payload):{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,state:'rascunho'})};
  const r=await request(path,opts);if(v!==contextVersion||app!==type)return;
  if(!r.item?.id)throw Error('Servidor não retornou o ID da campanha');
  selectedId=r.item.id;dirty=false;
  const list=await request(api());if(v!==contextVersion)return;
  items=list.items||[];const current=items.find(x=>x.id===selectedId)||r.item;editItem(current);
  status(`Rascunho ${wasNew?'criado':'salvo'} com sucesso. Nenhum envio externo foi realizado.`,'success');
  if(alsoPreview)await loadPreview(current.id);
 }catch(e){status('Não foi possível salvar: '+e.message,'error')}
 finally{if(v===contextVersion)setBusy(false)}
}
function paintPreview(p){
 previewResult=p;setText('preview-version',p.version||'Prévia');
 const shared=p.sharedBrief||{},settings=p.agentConfiguration||{};
 setText('preview-info',`Público: ${shared.audience||'não definido'} · Tom do perfil: ${settings.tone||'profissional'} · Origem: ${settings.source||'não informada'}`);
 const box=$('preview');box.replaceChildren();
 if(!p.channelDrafts?.length)showEmpty('preview','Nenhum canal selecionado no rascunho.');
 else for(const d of p.channelDrafts){
  const card=el('article','draft');card.append(el('h3','',d.label||d.channel||'Canal'));
  card.append(el('strong','',d.headline||''));card.append(el('p','',d.body||''));
  card.append(el('div','cta',d.callToAction||''));card.append(el('div','muted','Prévia local · Revisão obrigatória · Não publicado'));box.append(card);
 }
 const area=$('warnings');area.replaceChildren();const warnings=p.warnings||[];
 if(warnings.length){const warn=el('div','warnings');warn.append(el('strong','','⚠ Pontos para revisão humana'));for(const line of warnings)warn.append(el('p','',line));area.append(warn)}
 const agents=p.agents||[];
 const small=el('p','muted',`${agents.length} perfis de agentes considerados · Aprovação obrigatória: ${p.approvalRequired?'sim':'verificar'} · Publicação externa: ${p.externalPublicationEnabled?'verificar':'desativada'}`);
 area.append(small);
 $('preview-again').disabled=false;$('export').disabled=false;
}
async function loadPreview(id){if(!id)return;const v=contextVersion,app=type;
 try{
  const r=await request(`${api()}/${encodeURIComponent(id)}/previa`);
  if(v!==contextVersion||app!==type||id!==selectedId||dirty)return;
  paintPreview(r.preview||{});status('Prévia D4 carregada. Nenhuma publicação foi realizada.','success');
 }catch(e){if(v===contextVersion){clearPreview();status('Erro ao consultar prévia: '+e.message,'error')}}
}
function readProfileForm(){
 if(!profile)throw Error('Carregue o perfil antes de salvar.');
 const agents={};for(const key of Object.keys(AGENTS)){
  const enabled=document.querySelector(`[data-agent-enabled="${key}"]`);
  const instructions=document.querySelector(`[data-agent-instructions="${key}"]`);
  agents[key]={enabled:Boolean(enabled?.checked),instructions:instructions?.value||''};
 }
 return {objective:$('profile-objective').value,tone:$('profile-tone').value,
   audience:$('profile-audience').value,instructions:$('profile-instructions').value,agents};
}
async function saveProfile(){if(busy)return;let payload;
 try{payload=readProfileForm()}catch(e){profileStatus(e.message);return}
 const v=contextVersion;setBusy(true);profileStatus('Salvando perfil completo deste contexto…');
 try{
  const r=await request(api()+'/configuracao-ia',bodyJson(payload));if(v!==contextVersion)return;
  profile=r.profile;loadProfileIntoForm();profileStatus('Perfil D3 salvo neste contexto. Nenhum agente externo foi acionado.');
  if(selectedId&&!dirty)await loadPreview(selectedId);
 }catch(e){profileStatus('Erro ao salvar perfil: '+e.message)}
 finally{if(v===contextVersion)setBusy(false)}
}
function exportText(){if(!previewResult)return;
 const p=previewResult;const lines=['PROVADOR PRO - PREVIA LOCAL D5','RASCUNHO - NAO PUBLICADO','Contexto: '+TYPES[type],
 'Campanha: '+(p.sharedBrief?.title||''),'Objetivo: '+(p.sharedBrief?.objective||''),'Público: '+(p.sharedBrief?.audience||''),''];
 for(const c of p.channelDrafts||[]){lines.push('CANAL: '+c.label,c.headline||'',c.body||'',c.callToAction||'','')}
 lines.push('REVISAO OBRIGATORIA:',...(p.warnings||[]),'','Sem envio externo, IA real ou agendamento.');
 const blob=new Blob([lines.join('\r\n')],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='previa-campanha-pro-d5.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Event handlers
$('campaign-form').addEventListener('submit',e=>{e.preventDefault();saveCampaign(false)});
$('save-preview').addEventListener('click',()=>saveCampaign(true));
$('new').addEventListener('click',()=>{if(dirty&&!confirm('Descartar alterações ainda não salvas?'))return;resetForm();status('Novo rascunho. Preencha os dados e salve.');});
$('refresh').addEventListener('click',async()=>{if(busy)return;if(dirty&&!confirm('Descartar alterações ainda não salvas?'))return;setBusy(true);try{await refreshList();status('Campanhas atualizadas.','success')}catch(e){status('Erro ao atualizar: '+e.message,'error')}finally{setBusy(false)}});
$('preview-again').addEventListener('click',()=>{if(selectedId&&!dirty)loadPreview(selectedId)});
$('export').addEventListener('click',exportText);
$('save-profile').addEventListener('click',saveProfile);
$('reload-profile').addEventListener('click',async()=>{if(busy)return;if(!confirm('Recarregar configurações e descartar eventuais edições do perfil?'))return;setBusy(true);try{await reloadProfile();profileStatus('Perfil atualizado a partir do servidor.')}catch(e){profileStatus(e.message)}finally{setBusy(false)}});
for(const b of document.querySelectorAll('button[data-type]'))b.addEventListener('click',()=>switchContext(b.dataset.type));
for(const field of formFields())field.addEventListener('input',markDirty);
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
switchContext(type);
})();
