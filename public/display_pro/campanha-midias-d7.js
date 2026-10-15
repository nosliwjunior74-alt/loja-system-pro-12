(()=>{
'use strict';
// D7.1 - somente midias proprias. Nenhuma IA, compartilhamento externo ou publicacao.
const $=id=>document.getElementById(id);
const root=$('ppD7Media');if(!root)return;
const params=new URLSearchParams(location.search);
const isStore=params.get('context')==='loja';
const expectedStoreSlug=isStore?(params.get('loja')||''):'';
function withStore(url){if(!isStore)return url;const u=new URL(url,location.origin);u.searchParams.set('loja',expectedStoreSlug);return u.pathname+u.search;}
let context=isStore?'vendas_lojista':params.get('app')==='central_produtor'?'central_produtor':'vendas_produtor';
let busy=false,records=[],campaigns=[],pendingType='';
const base=()=>`/api/campanha-midias-d7/v1/${context}`;
const formatBytes=n=>n>=1048576?`${(n/1048576).toFixed(1)} MB`:`${Math.ceil(n/1024)} KB`;
function msg(t,error=false){$('ppD7Status').textContent=t;$('ppD7Status').style.color=error?'#8e2b37':'#61415a'}
function node(t,cls,text){const e=document.createElement(t);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e}
async function json(url,opts={}){
 const r=await fetch(withStore(url),{credentials:'same-origin',cache:'no-store',...opts});
 let d;try{d=await r.json()}catch{throw Error(`Resposta inválida do servidor (HTTP ${r.status})`)}
 if(!r.ok||d.ok===false)throw Error(d.error||`Erro HTTP ${r.status}`);
 return d;
}
function activeType(){return isStore?'vendas_lojista':context}
function setBusy(v){busy=v;for(const id of ['ppD7Upload','ppD7Refresh','ppD7File','ppD7Campaign'])$(id).disabled=v}
async function loadCampaigns(){
 const current=$('ppD7Campaign').value;
 const d=await json(`/api/campanha-unificada/v1/${context}`);
 campaigns=Array.isArray(d.items)?d.items:[];
 const sel=$('ppD7Campaign');sel.replaceChildren();
 const empty=node('option','', 'Sem vínculo com campanha');empty.value='';sel.append(empty);
 for(const c of campaigns){const o=node('option','',c.title||'Campanha sem título');o.value=c.id;sel.append(o)}
 if(campaigns.some(c=>c.id===current))sel.value=current;
}
function mediaUrl(id,download=false){return withStore(base()+'/'+encodeURIComponent(id)+'/arquivo'+(download?'?download=1':''))}
function cardFor(r){
 const card=node('article','pp-d7-item');
 const preview=node('div','pp-d7-media-preview');
 if(r.kind==='imagem'){
  const img=node('img');img.loading='lazy';img.alt='Prévia de '+r.name;img.src=mediaUrl(r.id);
  preview.append(img);
 }else{
  const v=node('video');v.controls=true;v.preload='metadata';v.playsInline=true;v.src=mediaUrl(r.id);v.setAttribute('aria-label','Prévia do vídeo '+r.name);preview.append(v);
 }
 card.append(preview);
 card.append(node('strong','pp-d7-filename',r.name));
 card.append(node('div','muted',`${r.kind==='video'?'Vídeo':'Imagem'} própria · ${formatBytes(r.bytes)}`));
 const select=node('select','pp-d7-item-link');select.setAttribute('aria-label','Campanha vinculada a '+r.name);
 const empty=node('option','', 'Sem vínculo com campanha');empty.value='';select.append(empty);
 for(const c of campaigns){const o=node('option','',c.title||'Campanha sem título');o.value=c.id;select.append(o)}
 select.value=campaigns.some(c=>c.id===r.campaignId)?r.campaignId:'';
 select.addEventListener('change',async()=>{
  const requested=select.value;select.disabled=true;
  try{await json(base()+'/'+encodeURIComponent(r.id)+'/campanha',{method:'PUT',headers:{'Content-Type':'application/json','X-PP-D7-Action':'1'},body:JSON.stringify({campaignId:requested})});msg('Vínculo da mídia atualizado.');}
  catch(e){select.value=r.campaignId||'';msg('Não foi possível vincular: '+e.message,true)}
  finally{select.disabled=false}
 });card.append(select);
 const actions=node('div','pp-d7-actions');
 const download=node('a','pp-d7-download','Baixar');download.href=mediaUrl(r.id,true);download.download=r.name;actions.append(download);
 const del=node('button','pp-d7-remove','Excluir');del.type='button';del.addEventListener('click',async()=>{
  if(!confirm(`Excluir definitivamente a mídia “${r.name}” da biblioteca D7?`))return;
  del.disabled=true;
  try{await json(base()+'/'+encodeURIComponent(r.id),{method:'DELETE',headers:{'X-PP-D7-Action':'1'}});msg('Mídia excluída.');await refresh(false)}
  catch(e){msg('Erro ao excluir: '+e.message,true)}finally{del.disabled=false}
 });actions.append(del);card.append(actions);return card;
}
async function checkStoreSession(){
 if(!isStore)return;
 if(!expectedStoreSlug)throw Error('Abra a Campanha Inteligente pelo painel da loja autenticada.');
 const res=await fetch('/api/public/session-store',{credentials:'same-origin',cache:'no-store'});
 if(!res.ok)throw Error('Sessao da loja indisponivel. Entre novamente.');
 const data=await res.json();
 if(data.store?.slug!==expectedStoreSlug)throw Error('Esta aba pertence a outra loja. Entre na loja correta antes de acessar midias.');
}
async function refresh(withCampaigns=true){
 await checkStoreSession();
 if(withCampaigns)await loadCampaigns();
 const data=await json(base());records=data.items||[];
 const list=$('ppD7List');list.replaceChildren();
 $('ppD7Usage').textContent=`${records.length} de ${data.quota.maxFiles} arquivos · ${formatBytes(data.quota.usedBytes)} de ${formatBytes(data.quota.maxBytes)}`;
 const filter=$('ppD7Filter').value;
 const shown=filter==='todos'?records:records.filter(r=>r.kind===filter);
 if(!shown.length){list.append(node('div','empty','Nenhuma mídia nesta categoria.'));return}
 for(const item of shown)list.append(cardFor(item));
}
async function upload(){
 if(busy)return;
 const file=$('ppD7File').files?.[0];if(!file)return msg('Selecione uma imagem ou vídeo.',true);
 const kind=file.type.startsWith('image/')?'imagem':file.type.startsWith('video/')?'video':null;
 if(!kind)return msg('Formato não suportado. Use JPG, PNG, WEBP, GIF, MP4, WEBM ou MOV.',true);
 const max=kind==='imagem'?10*1048576:60*1048576;
 if(file.size>max)return msg(`O arquivo excede ${formatBytes(max)}.`,true);
 const campaignId=$('ppD7Campaign').value;
 setBusy(true);msg('Enviando arquivo privado. Aguarde a conclusão…');
 try{
  await json(base()+'/upload'+(campaignId?'?campaignId='+encodeURIComponent(campaignId):''),{
   method:'POST',headers:{'Content-Type':'application/octet-stream','X-PP-D7-Action':'1','X-PP-D7-File-Name':encodeURIComponent(file.name),'X-PP-D7-Kind':kind},body:file
  });
  $('ppD7File').value='';await refresh(false);msg('Mídia adicionada com sucesso à biblioteca privada.');
 }catch(e){msg('Erro no envio: '+e.message,true)}finally{setBusy(false)}
}
async function switchType(t){
 if(isStore)t='vendas_lojista';
 if(!['central_produtor','vendas_produtor','vendas_lojista'].includes(t))return;
 if(busy){pendingType=t;return;}
 context=t;records=[];campaigns=[];$('ppD7List').replaceChildren();msg('Carregando a biblioteca privada…');
 setBusy(true);try{await refresh();msg('Biblioteca pronta. Apenas mídias deste aplicativo são exibidas.')}
 catch(e){msg('Não foi possível carregar: '+e.message,true)}finally{setBusy(false);if(pendingType&&pendingType!==context){const next=pendingType;pendingType='';switchType(next)}else pendingType=''}
}
$('ppD7Upload').addEventListener('click',upload);
$('ppD7Refresh').addEventListener('click',()=>{if(!busy)switchType(activeType())});
$('ppD7Filter').addEventListener('change',()=>{if(!busy)refresh(false).catch(e=>msg(e.message,true))});
if(!isStore){
 // Observa a troca realmente aceita pelo D5; clique cancelado nao troca a biblioteca.
 const tabs=$('tabs');
 const observer=new MutationObserver(()=>{
  const selected=tabs.querySelector('button[data-type][aria-selected="true"]');
  if(selected&&selected.dataset.type!==context)switchType(selected.dataset.type);
 });
 observer.observe(tabs,{subtree:true,attributes:true,attributeFilter:['aria-selected']});
}
// O nucleo D5 mantem selecao e edicao de campanhas; D7 guarda vinculo proprio.
switchType(context);
})();
