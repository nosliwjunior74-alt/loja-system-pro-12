'use strict';
// D8C V1: PLANEJAMENTO DE ORQUESTRACAO, SOMENTE LEITURA.
// Nao faz chamadas OpenAI, nao gera textos reais, nao salva, nao publica e nao agenda.
// A rota fica 404 a menos que PP_D8C_PREVIEW_ENABLED=true (independente da D8B).
const AGENTS=Object.freeze(['coordenador','estrategia','redacao','design','video','conformidade','analise','publicacao']);
const PHASES=Object.freeze([
  Object.freeze(['coordenador']),
  Object.freeze(['estrategia']),
  Object.freeze(['redacao','design','video']),
  Object.freeze(['conformidade','analise']),
  Object.freeze(['publicacao'])
]);
const REQUIRES=Object.freeze({
  coordenador:Object.freeze([]),
  estrategia:Object.freeze(['coordenador']),
  redacao:Object.freeze(['estrategia']),
  design:Object.freeze(['estrategia']),
  video:Object.freeze(['estrategia']),
  conformidade:Object.freeze(['redacao','design','video']),
  analise:Object.freeze(['redacao','design','video']),
  publicacao:Object.freeze(['conformidade','analise'])
});
const CONTEXTS=new Set(['central_produtor','vendas_produtor','vendas_lojista']);
const error=(status,message)=>Object.assign(new Error(message),{statusCode:status});
const str=(v,max)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);

function buildD8CPlan({ctx,campaign,profile}={}){
  if(!ctx||!CONTEXTS.has(ctx.type)||!str(ctx.owner,120))throw error(403,'Contexto D8C invalido');
  if(ctx.type!=='vendas_lojista'&&ctx.owner!=='produtor')throw error(403,'Contexto do Produtor invalido');
  if(!campaign||!str(campaign.id,100)||campaign.type!==ctx.type||String(campaign.owner)!==String(ctx.owner))throw error(404,'Campanha nao pertence ao contexto');
  if(campaign.state==='cancelado')throw error(409,'Campanha cancelada');
  if(!profile||typeof profile!=='object'||!profile.agents)throw error(409,'Perfil de agentes ausente');
  if(profile.requireApproval===false||profile.externalPublicationEnabled===true)throw error(409,'Perfil D8C exige revisao humana sem publicacao externa');
  const disabled=AGENTS.filter(agent=>profile.agents?.[agent]?.enabled===false);
  if(disabled.length)throw error(409,'Agentes nao liberados: '+disabled.join(', '));
  return {
    version:'D8C-V1-PLANO',mode:'SOMENTE_LEITURA_SEM_IA',
    scope:{type:ctx.type,owner:ctx.owner,campaignId:String(campaign.id)},
    campaignTitle:str(campaign.title,100),
    phases:PHASES.map((agents,index)=>({order:index+1,agents:[...agents]})),
    tasks:AGENTS.map(agent=>({agent,dependsOn:[...REQUIRES[agent]],execution:'NAO_EXECUTADO'})),
    agentsPlanned:AGENTS.length,maxParallelPlanned:2,
    callsMade:0,estimatedCallsIfAuthorizedLater:8,
    costUSD:null,budgetChecked:false,quotaChecked:false,
    note:'Plano sem estimativa financeira: antes de realizar IA paga, implementar reserva atomica de 8 chamadas, idempotencia persistente e aprovacao separada.',
    approvalRequired:true,externalPublicationEnabled:false,imageGenerationEnabled:false,videoGenerationEnabled:false,
    status:'PLANEJADO_NAO_EXECUTADO'
  };
}
function createD8CPreview({context,readCampaigns,readProfile,getStoreById,env=process.env}={}){
  if(typeof context!=='function'||typeof readCampaigns!=='function'||typeof readProfile!=='function'||typeof getStoreById!=='function')throw Error('D8C V1 exige core real para leitura segura');
  function setup(app){
    app.get('/api/campanha-unificada/v1/:type/:id/d8c/plano',(req,res)=>{
      res.set('Cache-Control','no-store');
      // Nada de publicacao ativa por acidente, mesmo que o motor D8B esteja ligado.
      if(env.PP_D8C_PREVIEW_ENABLED!=='true')return res.status(404).json({ok:false,error:'Previa D8C indisponivel'});
      try{
        const ctx=context(req,req.params.type);
        if(ctx.error)return res.status(ctx.error).json({ok:false,error:ctx.message});
        if(ctx.type==='vendas_lojista'){
          // Mesma protecao contra troca de loja/aba que o motor D8B.
          const expected=String(req.query?.loja||'').trim();
          const slug=String(req.session?.clientStoreSlug||'').trim();
          const store=getStoreById(ctx.owner);
          if(!expected||!slug||expected!==slug||!store||String(store.slug||'')!==slug||String(req.session?.clientStoreId||'')!==String(ctx.owner))
            return res.status(409).json({ok:false,error:'Aba e sessao da loja nao coincidem'});
        }
        const campaign=readCampaigns().find(item=>item.id===req.params.id&&item.type===ctx.type&&String(item.owner)===String(ctx.owner));
        if(!campaign)return res.status(404).json({ok:false,error:'Campanha nao encontrada'});
        const plan=buildD8CPlan({ctx,campaign,profile:readProfile(ctx).profile});
        return res.json({ok:true,plan});
      }catch(e){
        return res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:'Falha ao consultar plano D8C'});
      }
    });
  }
  return {setup};
}
module.exports={createD8CPreview,buildD8CPlan,AGENTS,PHASES,REQUIRES};
