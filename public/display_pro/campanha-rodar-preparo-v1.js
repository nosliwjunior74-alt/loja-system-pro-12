// PP_RODAR_CAMPANHA_PREVIA_D8C_V2
// Somente planejamento. Uma consulta GET autenticada OPCIONAL ao plano D8C, sem POST,
// execucao de agentes, credenciais externas, publicacao, agendamento, cobranca ou gravacao.
// Se a rota D8C estiver bloqueada, exibe APENAS o roteiro estatico identificado como tal.
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
    return {type:campaign.type||'',id:campaign.selectedId||'',loja:campaign.loja||'',dirty:Boolean(campaign.dirty),mode:form?.value==='pago'?'pago':'organico',chosen};
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
    consultationVersion++;
    const s=selection();const box=byId('ppRunPlan');box.replaceChildren();
    if(!s.chosen.length){box.hidden=true;setStatus('Selecione pelo menos uma rede para preparar o planejamento. Nenhum envio será realizado.');return;}
    const header=document.createElement('strong');header.textContent='Planejamento temporário — NÃO PUBLICADO';
    const paragraph=document.createElement('p');paragraph.textContent='Campanha: '+(s.id?'selecionada no editor':'ainda não salva')+(s.dirty?' (alterações pendentes)':'')+' · Contexto: '+(s.type||'aguardando')+' · Modalidade: '+(s.mode==='pago'?'paga (sem orçamento autorizado)':'orgânica');
    const dest=document.createElement('p');dest.textContent='Redes pretendidas: '+s.chosen.map(x=>channels[x]).join(', ')+'.';
    const note=document.createElement('p');note.textContent='Esta escolha ainda não é salva no servidor. Nenhuma rede está conectada. A publicação permanece bloqueada.';
    box.append(header,paragraph,dest,note);box.hidden=false;
    setStatus('Seleção preparada apenas para conferência. RODAR CAMPANHA, aprovar, agendar, publicar e pausar ainda não estão habilitados.','info');
  };
  // Fases estaticas conhecidas, NAO significam agentes executados nem prontos.
  const phases=Object.freeze([
    Object.freeze(['Coordenador']),Object.freeze(['Estratégia']),
    Object.freeze(['Redação','Design','Vídeo']),Object.freeze(['Conformidade','Análise']),
    Object.freeze(['Publicação'])
  ]);
  const agentLabels=Object.freeze({coordenador:'Coordenador',estrategia:'Estratégia',redacao:'Redação',design:'Design',video:'Vídeo',conformidade:'Conformidade',analise:'Análise',publicacao:'Publicação'});
  let consultationVersion=0;
  function appendLine(box,tag,value){
    const element=document.createElement(tag);element.textContent=value;box.append(element);return element;
  }
  function stillCurrent(s,version){
    const next=selection();return version===consultationVersion&&next.type===s.type&&next.id===s.id&&next.loja===s.loja&&next.dirty===s.dirty&&next.mode===s.mode&&next.chosen.join(',')===s.chosen.join(',');
  }
  async function consultPlan(s,version,info){
    // Nunca chamar a API sem ID de campanha salvo, nem com edicao pendente.
    if(s.dirty||!['central_produtor','vendas_produtor','vendas_lojista'].includes(s.type)||
       !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(s.id)||
       (s.type==='vendas_lojista'&&!s.loja)||!s.chosen.length){
      info.textContent='Prévia do servidor não consultada: salve e selecione uma campanha no contexto correto. O roteiro acima é apenas ilustrativo.';
      return;
    }
    // Endpoint de LEITURA do orquestrador. Nao muda flags nem autoriza uso de IA.
    const url='/api/campanha-unificada/v1/'+encodeURIComponent(s.type)+'/'+encodeURIComponent(s.id)+'/d8c/plano'+
      (s.type==='vendas_lojista'?'?loja='+encodeURIComponent(s.loja):'');
    let timer;const controller=new AbortController();
    try{
      timer=setTimeout(()=>controller.abort(),8000);
      const response=await fetch(url,{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'},signal:controller.signal});
      const body=await response.json().catch(()=>null);
      if(!stillCurrent(s,version))return;
      if(!response.ok||!body?.ok||!body?.plan){
        const explanation=response.status===404?'A prévia D8C pode estar desativada ou a campanha não foi encontrada.':
          response.status===401||response.status===403?'Sessão sem permissão para esta campanha.':
          'Prévia indisponível (HTTP '+response.status+').';
        info.textContent=explanation+' O roteiro acima continua apenas ilustrativo; nenhuma ação foi executada.';
        return;
      }
      const plan=body.plan;
      if(plan.mode!=='SOMENTE_LEITURA_SEM_IA'||plan.status!=='PLANEJADO_NAO_EXECUTADO'||
         plan.scope?.campaignId!==s.id||plan.scope?.type!==s.type||plan.callsMade!==0||
         !Array.isArray(plan.phases)||plan.phases.length!==5){
        info.textContent='Resposta inesperada na prévia D8C. Ignorada por segurança. Nenhuma execução realizada.';return;
      }
      const names=plan.phases.map((p)=>Array.isArray(p?.agents)?p.agents.map(x=>agentLabels[x]).filter(Boolean).join(' + '):'');
      if(names.some(x=>!x)){info.textContent='Sequência do servidor incompleta. Usando apenas roteiro ilustrativo.';return;}
      info.textContent='Prévia do servidor D8C consultada com sucesso — SOMENTE LEITURA; '+
        plan.agentsPlanned+' agentes planejados; 0 chamadas; nenhuma campanha executada. Sequência confirmada: '+names.join(' → ')+'.';
    }catch(e){if(stillCurrent(s,version))info.textContent='Não foi possível consultar a prévia D8C. O roteiro acima é apenas ilustrativo e nada foi executado.';}
    finally{clearTimeout(timer)}
  }
  function showWorkflow(s){
    const version=++consultationVersion;
    const box=byId('ppRunPlan');box.replaceChildren();box.hidden=false;
    appendLine(box,'strong','Prévia do fluxo D8C — NÃO EXECUTADO / NÃO PUBLICADO');
    appendLine(box,'p','Rede(s): '+(s.chosen.length?s.chosen.map(x=>channels[x]).join(', '):'nenhuma')+
      ' · Modalidade: '+(s.mode==='pago'?'paga, sem orçamento autorizado':'orgânica')+'.');
    const ol=document.createElement('ol');
    phases.forEach((names,i)=>appendLine(ol,'li','Etapa '+(i+1)+': '+names.join(' + ')+' — AINDA NÃO EXECUTADA'));
    box.append(ol);
    appendLine(box,'p','Dependências: Coordenador → Estratégia → Redação/Design/Vídeo → Conformidade/Análise → Publicação (somente após aprovação humana e integrações oficiais).');
    const info=appendLine(box,'p','Consulta à prévia do servidor: verificando requisitos...');
    void consultPlan(s,version,info);
  }
  byId('ppRunPrepare').addEventListener('click',prepare);
  byId('ppRunCampaignAction').addEventListener('click',()=>{
    const s=selection();const lines=blockers(s).map((x,i)=>`${i+1}. ${x}`);
    setStatus('RODAR CAMPANHA BLOQUEADO — nenhuma execução foi iniciada.\nPendências para a futura liberação:\n'+lines.join('\n'));
    showWorkflow(s);
  });
  root.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
    consultationVersion++;
    byId('ppRunPlan').hidden=true;
    setStatus('Seleção alterada. Clique em “Preparar seleção” para conferir. Nenhum envio será realizado.','info');
  }));
})();
