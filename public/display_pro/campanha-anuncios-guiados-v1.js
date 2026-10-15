(()=>{
'use strict';
// D6 V1 - Planejamento didatico. Nao usa rede, cookies, API externa nem executa publicacao.
const $=id=>document.getElementById(id);
const box=$('ppAdsGuideD6');if(!box)return;
const channels={instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',whatsapp:'WhatsApp Business (somente contatos autorizados)',google_business:'Perfil da Empresa no Google'};
const paid=['instagram','facebook','tiktok'];
const organic=['instagram','facebook','tiktok','whatsapp','google_business'];
const goals={reconhecimento:'apresentar a marca a novos interessados',interesse:'despertar interesse e incentivar interações',mensagens:'receber mensagens de pessoas interessadas',vendas:'apresentar uma oferta e incentivar pedidos'};
const formats={instagram:'Imagem/carrossel ou vídeo curto com mensagem objetiva',facebook:'Publicação com imagem e chamada clara para o público',tiktok:'Vídeo curto, com áudio licenciado e demonstração',whatsapp:'Status ou conversa autorizada; não enviar mensagens em massa sem consentimento',google_business:'Atualização ou publicação informativa no Perfil da Empresa, respeitando elegibilidade'};
let context='vendas_lojista',mode='organico',applied=null,lastPlan=null,busy=false;
const updateStatus=message=>$('adGuideStatus').textContent=message;
function setupPlatforms(keep=false){
 const select=$('adPlatform'),before=keep?select.value:null,choices=mode==='pago'?paid:organic;
 select.replaceChildren();
 for(const key of choices){const opt=document.createElement('option');opt.value=key;opt.textContent=channels[key];select.append(opt)}
 if(before&&choices.includes(before))select.value=before;
}
function showMode(m,keep=false){
 mode=m==='pago'?'pago':'organico';
 for(const b of box.querySelectorAll('[data-ad-mode]'))b.setAttribute('aria-pressed',String(b.dataset.adMode===mode));
 $('adBudgetArea').hidden=mode!=='pago';$('adPeriodArea').hidden=mode!=='pago';
 setupPlatforms(keep);invalidate();
}
function invalidate(){lastPlan=null;$('adApply').disabled=true;$('adAdvice').textContent='Opções alteradas. Clique em “Ver orientação e checklist” para atualizar.';updateStatus('Nenhuma alteração enviada ao servidor. Para guardar, aplique ao rascunho e salve.');}
function read(){
 const product=$('adProduct').value.trim(),audience=$('adAudience').value.trim(),goal=$('adGoal').value,channel=$('adPlatform').value;
 if(!product)throw Error('Informe o produto, coleção, plano ou módulo que deseja divulgar.');
 if(!audience)throw Error('Informe quem você deseja alcançar.');
 if(!Object.hasOwn(goals,goal)||!Object.hasOwn(channels,channel))throw Error('Escolha objetivo e canal válidos.');
 if((mode==='pago'&&!paid.includes(channel))||(mode==='organico'&&!organic.includes(channel)))throw Error('Canal incompatível com a modalidade.');
 let budget=null,period=null;
 if(mode==='pago'){
   budget=Number($('adBudget').value);
   if(!$('adBudget').value.trim()||!Number.isFinite(budget)||budget<=0||budget>1000000)throw Error('Para planejar anúncio pago, informe um orçamento positivo em R$ (até 1 milhão).');
   period=$('adBudgetPeriod').value==='diario'?'diario':'total';
 }
 return {version:1,mode,goal,channel,product:product.slice(0,160),audience:audience.slice(0,160),budget,period};
}
function advice(d){
 const noun=context==='vendas_lojista'?'loja':'Provador Pro';
 const type=d.mode==='pago'?'PAGO (planejamento sem compra de mídia)':'ORGÂNICO (sem compra de mídia)';
 const budget=d.mode==='pago'?`\nOrçamento indicado por você: R$ ${d.budget.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} (${d.period==='diario'?'por dia':'total'}). Não será cobrado.`:'';
 const special=d.channel==='whatsapp'?'\nWhatsApp: use apenas contatos com consentimento e respeite as regras de atendimento e templates.':d.channel==='google_business'?'\nPerfil da Empresa: o canal disponível aqui é orgânico; anúncios pagos do Google Ads exigem futura integração separada.':'';
 return `PLANO INICIAL — ${type}\n\nObjetivo: ${goals[d.goal]}.\nOferta/tema: ${d.product}\nPúblico: ${d.audience}\nCanal da prévia: ${channels[d.channel]}\nFormato sugerido: ${formats[d.channel]}${budget}\n\nPASSOS SUGERIDOS\n1. Confirme o objetivo e o público real de ${noun}.\n2. Prepare uma peça com benefício claro, sem prometer resultados garantidos.\n3. Confira preço, estoque, condições, data e link/contato.\n4. Revise autorizações de imagem/áudio, uso de dados e política atual do canal.\n5. Aplique ao rascunho e revise o texto gerado antes de usar.${d.mode==='pago'?'\n6. Antes de qualquer campanha futura, confirme conta de anúncios, segmentação, orçamento e aprovação expressa do titular.':''}${special}\n\nPRÉ-VALIDAÇÃO: PENDENTE DE REVISÃO HUMANA. Não equivale à aprovação da plataforma. Sem envio, agendamento, anúncio ativo ou gasto.`;
}
function render(){try{const d=read();lastPlan=d;$('adAdvice').textContent=advice(d);$('adApply').disabled=busy;updateStatus('Plano orientativo preparado. Clique em “Aplicar ao rascunho”; depois revise e salve.');}catch(e){lastPlan=null;$('adApply').disabled=true;$('adAdvice').textContent='Atenção: '+e.message;updateStatus('Complete os campos para receber uma orientação.')}}
function apply(){
 if(busy||!lastPlan)return;
 const d=read();
 // Mantem os campos ja preenchidos manualmente. Nao substitui ofertas de uma campanha existente.
 const subject=$('subject'),objective=$('objective'),title=$('title'),audience=$('audience'),cta=$('cta');
 if(!subject.value.trim())subject.value=d.product;
 if(!audience.value.trim())audience.value=d.audience;
 if(!title.value.trim())title.value=(context==='vendas_lojista'?'Divulgação: ':'Apresentação: ')+d.product.slice(0,85);
 if(!objective.value.trim())objective.value=`${goals[d.goal][0].toUpperCase()+goals[d.goal].slice(1)} com ${d.product} para ${d.audience}. Modalidade planejada: ${d.mode==='pago'?'paga':'orgânica'}.`;
 if(!cta.value.trim())cta.value=d.goal==='mensagens'?'Fale com nossa equipe':d.goal==='vendas'?'Conheça a oferta':'Saiba mais';
 const target=$('channels').querySelector(`input[value="${d.channel}"]`);
 if(target&&!target.checked){target.checked=true;target.dispatchEvent(new Event('change',{bubbles:true}))}
 applied={...d};
 objective.dispatchEvent(new Event('input',{bubbles:true}));
 updateStatus('Orientação aplicada ao editor. Revise título, objetivo, canais e oferta; depois SALVE O RASCUNHO. Nada foi publicado ou cobrado.');
 $('campaign-form').scrollIntoView({block:'start',behavior:'smooth'});
}
function reset(){applied=null;lastPlan=null;$('adProduct').value='';$('adAudience').value='';$('adGoal').value='reconhecimento';$('adBudget').value='';$('adBudgetPeriod').value='total';showMode('organico');$('adAdvice').textContent='Escolha as opções e clique em “Ver orientação e checklist”.';updateStatus('Primeiro planeje, depois aplique ao rascunho e salve.');}
function load(stored){reset();if(!stored||stored.version!==1||!['pago','organico'].includes(stored.mode))return;
 showMode(stored.mode);$('adGoal').value=Object.hasOwn(goals,stored.goal)?stored.goal:'reconhecimento';$('adProduct').value=String(stored.product||'').slice(0,160);$('adAudience').value=String(stored.audience||'').slice(0,160);
 if((stored.mode==='pago'?paid:organic).includes(stored.channel))$('adPlatform').value=stored.channel;
 $('adBudget').value=stored.budget??'';$('adBudgetPeriod').value=stored.period==='diario'?'diario':'total';
 // So dados ja persistidos sao reconhecidos como aplicados.
 applied={...stored};try{lastPlan=read();$('adAdvice').textContent=advice(lastPlan);$('adApply').disabled=busy;}catch(_){lastPlan=null}
 updateStatus('Planejamento salvo neste rascunho. Revise antes de publicar qualquer material externamente.');}
function setContext(c){context=c;box.hidden=c==='central_produtor';reset();}
function setBusy(v){busy=!!v;$('adAdvise').disabled=busy;$('adApply').disabled=busy||!lastPlan;}
box.querySelectorAll('[data-ad-mode]').forEach(b=>b.addEventListener('click',()=>{if(!busy)showMode(b.dataset.adMode)}));
for(const id of ['adGoal','adPlatform','adProduct','adAudience','adBudget','adBudgetPeriod'])$(id).addEventListener('input',invalidate);
$('adAdvise').addEventListener('click',render);$('adApply').addEventListener('click',apply);
reset();
window.PPAdGuideD6={setContext,reset,load,setBusy,campaignBriefFields(previous){return context==='central_produtor'?{}:{adGuide:applied??previous??undefined}}};
})();
