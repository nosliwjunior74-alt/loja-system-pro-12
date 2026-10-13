'use strict';
// V1.15.2D D2 — coordenador de PREVIAS locais. Sem modelo IA, rede ou disparo.
const CHANNEL_LABELS=Object.freeze({carrossel:'Carrossel de Lojistas',instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',whatsapp:'WhatsApp Business',google_business:'Perfil da Empresa no Google'});
function safeText(value,max=220){return String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max)}
function previewCampaign(item,{store=null}={}){
  const brief=item.campaignBrief&&typeof item.campaignBrief==='object'&&!Array.isArray(item.campaignBrief)?item.campaignBrief:{};
  const title=safeText(item.title,100);
  const objective=safeText(item.objective,500);
  const subject=safeText(item.subject||brief.product||brief.offer,160);
  const storeName=item.type==='vendas_lojista'?safeText(store?.name,100):'Provador Pro';
  const branding=item.type==='vendas_lojista'?{storeName,color:safeText(store?.color,30),logoConfigured:Boolean(store?.logo)}:{storeName};
  const offer=safeText(brief.offer,180);
  const audience=safeText(brief.audience,180);
  const callToAction=safeText(brief.callToAction,120)||'Saiba mais';
  const channels=(item.channels||[]).filter(x=>Object.hasOwn(CHANNEL_LABELS,x));
  const base=[title,subject,offer].filter(Boolean).join(' — ');
  const warnings=[];
  if(!channels.length)warnings.push('Selecione ao menos um canal antes de preparar publicacao.');
  if(!audience)warnings.push('Publico-alvo nao definido.');
  if(!offer)warnings.push('Oferta nao detalhada: confira preco, validade e disponibilidade.');
  if(item.type==='vendas_lojista'&&!store)warnings.push('Configuracao da loja nao encontrada.');
  if(channels.includes('whatsapp'))warnings.push('WhatsApp: verificar consentimento, janela de atendimento e templates aprovados.');
  if(channels.includes('google_business'))warnings.push('Perfil da Empresa no Google: confirmar elegibilidade e politica atual da publicacao.');
  if(channels.includes('tiktok'))warnings.push('TikTok: verificar licenca de audio/video e formato aceito.');
  const cards=channels.map(channel=>({channel,label:CHANNEL_LABELS[channel],headline:title,body:safeText(`${base}. ${objective}`,channel==='whatsapp'?350:500),callToAction,requiredReview:true,deliveryStatus:'nao_configurado'}));
  return {version:'V1.15.2D-D2',context:item.type,campaignId:item.id,branding,sharedBrief:{title,objective,subject,offer,audience,callToAction},agents:[{name:'coordenador',status:'previa_local'},{name:'estrategia',status:'previa_local'},{name:'redacao',status:'previa_local'},{name:'conformidade',status:'alertas_basicos'}],channelDrafts:cards,warnings,approvalRequired:true,aiGenerationEnabled:false,externalPublicationEnabled:false,trackingEnabled:false,scheduleExecutionEnabled:false};
}
module.exports={previewCampaign};
