// PP_RODAR_CAMPANHA_PREPARO_V1
// Somente interface e planejamento local transitório. NÃO tem fetch, POST, publicação,
// credenciais, agendamento, cobrança, API externa nem armazenamento persistente.
(()=>{'use strict';
  const root=document.getElementById('ppRunCampaignV1');
  if(!root)return;
  const byId=id=>document.getElementById(id);
  const channels=Object.freeze({instagram:'Instagram',facebook:'Facebook',tiktok:'TikTok',youtube:'YouTube',google_business:'Perfil da Empresa no Google',google_ads:'Google Ads',whatsapp:'WhatsApp Business'});
  const text=(id,value)=>{const node=byId(id);if(node)node.textContent=value};
  const selection=()=>{
    const form=root.querySelector('input[name="ppRunAdType"]:checked');
    const chosen=Array.from(byId('ppRunChannels').querySelectorAll('input:checked')).map(x=>x.value).filter(x=>Object.hasOwn(channels,x));
    const campaign=(typeof window.PPD8CurrentCampaign==='function'?window.PPD8CurrentCampaign():null)||{};
    return {type:campaign.type||'',id:campaign.selectedId||'',dirty:Boolean(campaign.dirty),mode:form?.value==='pago'?'pago':'organico',chosen};
  };
  const setStatus=(msg,kind)=>{
    const node=byId('ppRunResult');node.textContent=msg;
    node.classList.toggle('pp-run-info',kind==='info');
  };
  const blockers=s=>{
    const list=[];
    if(!s.id)list.push('salvar e selecionar uma campanha antes de produzir');
    if(s.dirty)list.push('salvar as alterações do rascunho');
    if(s.type==='central_produtor')list.push('a Central de Comunicados é interna; para divulgação externa, usar o aplicativo de vendas do Produtor');
    if(!s.chosen.length)list.push('selecionar ao menos uma rede');
    if(s.mode==='pago'&&s.chosen.some(c=>['whatsapp','google_business'].includes(c)))list.push('rever os destinos pagos: WhatsApp e Perfil da Empresa não equivalem a um gerenciador de anúncios');
    if(s.mode==='organico'&&s.chosen.includes('google_ads'))list.push('Google Ads é destinado a anúncios pagos; escolha outro canal para o modo orgânico');
    list.push('concluir e validar individualmente os oito agentes, inclusive imagens e vídeos reais');
    list.push('conectar contas oficiais de cada rede e validar suas permissões');
    list.push('passar por conformidade, revisão humana e aprovação das peças e do orçamento');
    list.push('implementar e testar os serviços de publicação, agendamento e acompanhamento');
    return list;
  };
  const prepare=()=>{
    const s=selection();const box=byId('ppRunPlan');box.replaceChildren();
    if(!s.chosen.length){box.hidden=true;setStatus('Selecione pelo menos uma rede para preparar o planejamento. Nenhum envio será realizado.');return;}
    const header=document.createElement('strong');header.textContent='Planejamento temporário — NÃO PUBLICADO';
    const paragraph=document.createElement('p');paragraph.textContent='Campanha: '+(s.id?'selecionada no editor':'ainda não salva')+(s.dirty?' (alterações pendentes)':'')+' · Contexto: '+(s.type||'aguardando')+' · Modalidade: '+(s.mode==='pago'?'paga (sem orçamento autorizado)':'orgânica');
    const dest=document.createElement('p');dest.textContent='Redes pretendidas: '+s.chosen.map(x=>channels[x]).join(', ')+'.';
    const note=document.createElement('p');note.textContent='Esta escolha ainda não é salva no servidor. Nenhuma rede está conectada. A publicação permanece bloqueada.';
    box.append(header,paragraph,dest,note);box.hidden=false;
    setStatus('Seleção preparada apenas para conferência. RODAR CAMPANHA, aprovar, agendar, publicar e pausar ainda não estão habilitados.','info');
  };
  byId('ppRunPrepare').addEventListener('click',prepare);
  byId('ppRunCampaignAction').addEventListener('click',()=>{
    const s=selection();const lines=blockers(s).map((x,i)=>`${i+1}. ${x}`);
    setStatus('RODAR CAMPANHA BLOQUEADO — nenhuma execução foi iniciada.\nPendências para a futura liberação:\n'+lines.join('\n'));
    byId('ppRunPlan').hidden=true;
  });
  root.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
    byId('ppRunPlan').hidden=true;
    setStatus('Seleção alterada. Clique em “Preparar seleção” para conferir. Nenhum envio será realizado.','info');
  }));
})();
