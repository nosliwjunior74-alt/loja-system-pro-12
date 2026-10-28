'use strict';
// D8C: laboratorio de PASSAGEM de dados entre agentes. NAO e IA gerativa.
// Sem fetch, API externa, disco, filas, GPU, envio, publicacao ou cobranca.
const {AGENTS,REQUIRES,buildD8CPlan}=require('./orquestrador-d8c-v1');
const scrub=(v,n=250)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const fail=(code,msg)=>{const e=new Error(msg);e.statusCode=code;throw e};

function runCommunicationLab({ctx,campaign,profile}={}) {
  const plan=buildD8CPlan({ctx,campaign,profile}); // reaproveita protecoes D8C existentes
  const brief=campaign.campaignBrief&&typeof campaign.campaignBrief==='object'&&!Array.isArray(campaign.campaignBrief)?campaign.campaignBrief:{};
  const source=Object.freeze({
    title:scrub(campaign.title,100),objective:scrub(campaign.objective,400),subject:scrub(campaign.subject,160),
    audience:scrub(brief.audience||profile.audience,180),offer:scrub(brief.offer,180),
    callToAction:scrub(brief.callToAction,100),channels:(campaign.channels||[]).filter(c=>typeof c==='string').slice(0,6)
  });
  const output=new Map(),executions=[];
  for(const name of AGENTS){
    const required=REQUIRES[name];
    if(!required.every(x=>output.has(x)))fail(409,'Dependencia de agente nao satisfeita: '+name);
    // Contrato: um agente so recebe entregas dos predecessores declarados.
    const inputs=Object.fromEntries(required.map(x=>[x,output.get(x)]));
    const coordinator=inputs.coordenador?.data;
    const strategy=inputs.estrategia?.data;
    let data;
    switch(name){
      case 'coordenador':
        data={brief:source,observacao:'Briefing reunido, sem criar fatos novos'};break;
      case 'estrategia':
        data={publico:coordinator.brief.audience||'Nao informado',canais:coordinator.brief.channels,
          objetivo:coordinator.brief.objective,oferta:coordinator.brief.offer||'A confirmar'};break;
      case 'redacao':
        data={titulo:source.title||'Campanha sem titulo',textoBase:[source.subject,source.offer,source.callToAction].filter(Boolean).join(' — '),
          publico:strategy.publico,revisaoHumana:true,publicado:false};break;
      case 'design':
        data={briefVisual:source.subject||source.title,canais:strategy.canais,imagemGerada:false,
          nota:'Briefing textual; gerador real de imagem ainda nao conectado'};break;
      case 'video':
        data={storyboard:'Mostrar '+(source.subject||'o produto')+' e concluir com chamada revisada',
          oferta:strategy.oferta,arquivoMP4Gerado:false,nota:'AI Video Pro ainda nao conectado a este orquestrador'};break;
      case 'conformidade':
        data={itensRecebidos:Object.keys(inputs),pendencias:[
          ...(!source.audience?['Confirmar publico-alvo']:[]),
          ...(!source.offer?['Confirmar oferta']:[]),
          ...(source.channels.includes('whatsapp')?['Verificar consentimento e regras WhatsApp']:[]),
          'Revisar veracidade do anuncio e autorizacoes de imagem'
        ],aprovacaoReal:false,alerta:'Checklist preliminar; nao e aprovacao juridica'};break;
      case 'analise':
        data={insumosRecebidos:Object.keys(inputs),metricasPlanejadas:['leads','conversoes','vendas confirmadas'],
          metricasReaisConsultadas:false,nenhumResultadoInventado:true};break;
      case 'publicacao':
        data={dependenciasRecebidas:Object.keys(inputs),estado:'AGUARDANDO_REVISAO_HUMANA',
          agendamentoRealizado:false,publicacaoRealizada:false,envioWhatsApp:false};break;
      default:fail(500,'Agente nao reconhecido');
    }
    const item=Object.freeze({agent:name,mode:'FLUXO_LOCAL_SEM_IA',dependsOn:[...required],data:Object.freeze(data)});
    output.set(name,item);
    executions.push(item);
  }
  const handoffs=executions.flatMap(x=>x.dependsOn.map(from=>({from,to:x.agent})));
  return {ok:true,version:'D8C-COMUNICACAO-V1',mode:'LAB_LOCAL_SEM_IA',scope:{type:ctx.type,owner:ctx.owner,campaignId:campaign.id},
    agentsExecuted:executions.length,handoffs,executions,phases:plan.phases,
    callsMade:0,costUSD:0,externalPublicationEnabled:false,imageGenerationEnabled:false,
    videoGenerationEnabled:false,approvalRequired:true,persisted:false,
    warning:'PASSAGEM REAL DE DADOS DO LAB; CONTEUDO DETERMINISTICO. NENHUM DOS 8 AGENTES FEZ IA PAGA OU PUBLICOU.'};
}

function createD8CCommunicationLab({context,readCampaigns,readProfile,getStoreById,env=process.env}={}){
  if([context,readCampaigns,readProfile,getStoreById].some(x=>typeof x!=='function'))throw Error('Dependencias D8C obrigatorias');
  const prefix='/api/campanha-unificada/v1/:type/:id/d8c/comunicacao-lab';
  function identify(req,res){
    const ctx=context(req,req.params.type);
    if(ctx.error){res.status(ctx.error).json({ok:false,error:ctx.message});return null}
    if(ctx.type==='vendas_lojista'){
      const expected=scrub(req.query?.loja,120);
      const slug=scrub(req.session?.clientStoreSlug,120);
      const store=getStoreById(ctx.owner);
      if(!expected||!slug||slug!==expected||String(req.session?.clientStoreId||'')!==String(ctx.owner)||!store||String(store.slug||'')!==slug){
        res.status(409).json({ok:false,error:'Sessao de loja e aba divergentes'});return null;
      }
    }
    const campaign=readCampaigns().find(c=>c.id===req.params.id&&c.type===ctx.type&&String(c.owner)===String(ctx.owner));
    if(!campaign){res.status(404).json({ok:false,error:'Campanha nao encontrada neste contexto'});return null}
    return {ctx,campaign};
  }
  function protectMutation(req){
    if(req.get('x-pp-d8-action')!=='1')fail(403,'Cabecalho de confirmacao ausente');
    if(!/^application\/json\s*(?:;|$)/i.test(req.get('content-type')||''))fail(415,'JSON obrigatorio');
    let origin;try{origin=new URL(req.get('origin')||'')}catch{fail(403,'Origem ausente ou invalida')}
    if(origin.host.toLowerCase()!==String(req.get('host')||'').toLowerCase()||origin.protocol!==(req.protocol+':'))
      fail(403,'Origem diferente do sistema');
    if(req.body?.modo!=='laboratorio_sem_ia'||req.body?.confirmarSemIA!==true)fail(400,'Confirmacao explicita de laboratorio obrigatoria');
  }
  function setup(app){
    app.get(prefix,(req,res)=>{
      res.set('Cache-Control','no-store');
      if(env.PP_D8C_COMUNICACAO_LAB!=='true')return res.status(404).json({ok:false,error:'Laboratorio desligado'});
      try{
        const identified=identify(req,res);if(!identified)return;
        const {ctx,campaign}=identified;const plan=buildD8CPlan({ctx,campaign,profile:readProfile(ctx).profile});
        return res.json({ok:true,mode:'LAB_LOCAL_SEM_IA',plan,executionAvailable:true,publicationEnabled:false});
      }catch(e){return res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:'Falha D8C'})}
    });
    app.post(prefix,(req,res)=>{
      res.set('Cache-Control','no-store');
      if(env.PP_D8C_COMUNICACAO_LAB!=='true')return res.status(404).json({ok:false,error:'Laboratorio desligado'});
      try{
        const identified=identify(req,res);if(!identified)return;
        protectMutation(req);
        return res.json(runCommunicationLab({...identified,profile:readProfile(identified.ctx).profile}));
      }catch(e){return res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:'Falha D8C'})}
    });
  }
  return {setup};
}
module.exports={runCommunicationLab,createD8CCommunicationLab};
