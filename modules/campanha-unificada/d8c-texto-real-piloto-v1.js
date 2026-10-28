'use strict';
// D8C piloto de TEXTO REAL, um agente por autorizacao. DESLIGADO por padrao.
// Usa o MESMO ledger financeiro e o MESMO lock do D8B; nao modifica o motor D8B.
// Nao cria imagens, MP4, anuncios, emails, WhatsApp, agendamentos ou publicacoes.
const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {AGENTS,REQUIRES}=require('./orquestrador-d8c-v1');
const {campaignFacts,createHandoffRequest,acceptTextDelivery}=require('./d8c-ponte-real-prep-v1');
const price=v=>{let n=Number(v);return Number.isFinite(n)&&n>0&&n<=1000?n:0};
const cents=v=>{const s=String(v??'');return /^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):0};
const whole=(v,cap)=>/^\d+$/.test(String(v??''))?Math.min(+v,cap):0;
const error=(status,message)=>Object.assign(new Error(message),{statusCode:status});
const safe=(s,n=6000)=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
function parseOutput(body){
  if(typeof body?.output_text==='string'&&body.output_text.trim())return body.output_text;
  return (Array.isArray(body?.output)?body.output:[]).flatMap(v=>v?.content||[]).filter(v=>v?.type==='output_text'&&typeof v.text==='string').map(v=>v.text).join('\n');
}
function createD8CTextRealPilot({dataDir,context,readCampaigns,readProfile,getStoreById,env=process.env,fetchImpl=globalThis.fetch,now=()=>new Date()}={}){
  if(!dataDir||[context,readCampaigns,readProfile,getStoreById].some(x=>typeof x!=='function'))throw Error('Dependencias obrigatorias ausentes');
  const directory=path.join(dataDir,'campanha-unificada-d8a');
  const ledger=path.join(directory,'geracoes-v1.json');
  const lock=ledger+'.lock';
  const ownerKey=c=>c.type+'::'+c.owner;
  const active=()=>env.PP_D8C_TEXT_REAL_V1_ENABLED==='true';
  const settings=()=>({
    key:env.OPENAI_API_KEY||'',
    on:active()&&env.PP_D8C_TEXT_REAL_V1_PAID_ENABLED==='true'&&env.PP_D8C_TEXT_REAL_V1_APPROVED==='true',
    model:safe(env.PP_D8_AI_MODEL||env.OPENAI_MODEL||'',100),
    maxOutput:Math.min(600,whole(env.PP_D8_AI_MAX_OUTPUT_TOKENS,1000)||400),
    ownCalls:whole(env.PP_D8_AI_MONTHLY_CALLS,20),globalCalls:whole(env.PP_D8_AI_GLOBAL_MONTHLY_CALLS,100),
    inputPrice:price(env.PP_D8B_INPUT_USD_PER_1M),outputPrice:price(env.PP_D8B_OUTPUT_USD_PER_1M),
    ownBudget:cents(env.PP_D8B_MONTHLY_BUDGET_USD),globalBudget:cents(env.PP_D8B_GLOBAL_BUDGET_USD),maxRequest:cents(env.PP_D8B_MAX_REQUEST_USD)
  });
  function configReady(s){return s.on&&Boolean(s.key)&&s.model&&s.inputPrice&&s.outputPrice&&s.ownCalls&&s.globalCalls&&s.ownBudget&&s.globalBudget&&s.maxRequest}
  function inPilot(ctx,campaign){return env.PP_D8C_TEXT_REAL_V1_PILOT_TYPE===ctx.type&&
    String(env.PP_D8C_TEXT_REAL_V1_PILOT_OWNER||'')===String(ctx.owner)&&
    env.PP_D8C_TEXT_REAL_V1_PILOT_CAMPAIGN_ID===String(campaign.id)}
  function readLedger(){try{const rows=JSON.parse(fs.readFileSync(ledger,'utf8'));if(!Array.isArray(rows))throw Error('Ledger invalido');return rows}
    catch(e){if(e.code==='ENOENT')return [];throw error(409,'Registro financeiro D8B indisponivel ou invalido') }}
  function writeLedger(rows){fs.mkdirSync(directory,{recursive:true,mode:0o700});const temp=ledger+'.'+crypto.randomUUID()+'.tmp';
    try{fs.writeFileSync(temp,JSON.stringify(rows,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,ledger)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}}
  // Mesmo lock da D8B, sem autocura: qualquer divergencia bloqueia a cobranca.
  function locked(fn){fs.mkdirSync(directory,{recursive:true,mode:0o700});let fd;
    try{fd=fs.openSync(lock,'wx',0o600)}catch(e){if(e.code==='EEXIST')throw error(409,'Ledger ocupado: nenhuma chamada enviada');throw e}
    try{fs.writeSync(fd,JSON.stringify({pid:process.pid,host:os.hostname(),createdAt:now().toISOString()}));fs.fsyncSync(fd);return fn()}
    finally{try{fs.closeSync(fd)}finally{fs.unlinkSync(lock)}}
  }
  function budgetState(rows,ctx,period){let own=0,global=0,ownCalls=0,globalCalls=0;
    for(const r of rows.filter(x=>x.period===period)){
      if(!Number.isSafeInteger(r.reservedCostMicroUSD)||r.reservedCostMicroUSD<0)throw error(409,'Ledger com custo incerto');
      const n=Math.max(r.reservedCostMicroUSD,r.actualCostMicroUSD??0);
      if(!Number.isSafeInteger(n)||n<0)throw error(409,'Ledger com custo invalido');
      global+=n;globalCalls++;if(r.ownerKey===ownerKey(ctx)){own+=n;ownCalls++}
    }
    return {own,global,ownCalls,globalCalls};
  }
  function campaignFor(ctx,id){return readCampaigns().find(x=>x.id===id&&x.type===ctx.type&&String(x.owner)===String(ctx.owner))}
  function verifyRequest(req){if(req.get('x-pp-d8-action')!=='1')throw error(403,'Cabecalho de autorizacao D8 ausente');
    const origin=req.get('origin');if(!origin)throw error(403,'Origem obrigatoria');let u;
    try{u=new URL(origin)}catch{throw error(403,'Origem invalida')}
    if(u.host.toLowerCase()!==String(req.get('host')||'').toLowerCase()||u.protocol!==req.protocol+':')throw error(403,'Origem nao autorizada');
    if(!/^application\/json\s*(?:;|$)/i.test(req.get('content-type')||''))throw error(415,'JSON obrigatorio')}
  function ctxFor(req){const c=context(req,req.params.type);if(c.error)throw error(c.error,c.message);
    if(c.type==='vendas_lojista'){
      const slug=safe(req.session?.clientStoreSlug,120),expected=safe(req.query?.loja,120),store=getStoreById(c.owner);
      if(!slug||slug!==expected||!store||String(store.slug)!==slug||String(req.session?.clientStoreId)!==String(c.owner))throw error(409,'Sessao e loja divergentes');
    }return c}
  function scopeRows(rows,ctx,campaign){return rows.filter(r=>r.source==='D8C_TEXT_REAL_V1'&&r.ownerKey===ownerKey(ctx)&&r.campaignId===campaign.id)}
  function results(rows){return rows.map(r=>({agent:r.agent,status:r.status,text:r.status==='concluido'?safe(r.answer):'',
    createdAt:r.createdAt,id:r.id,inputTokens:r.inputTokens||0,outputTokens:r.outputTokens||0}))}
  function fail(res,e){if(!res.headersSent)res.status(e.statusCode||500).json({ok:false,error:e.statusCode?e.message:'Nao foi possivel concluir a execucao D8C'})}
  function setup(app){
    const route='/api/campanha-unificada/v1/:type/:id/d8c/texto-real-v1';
    app.get(route,(req,res)=>{res.set('Cache-Control','no-store');if(!active())return res.status(404).json({ok:false,error:'Piloto desativado'});
      try{const ctx=ctxFor(req),campaign=campaignFor(ctx,req.params.id);if(!campaign)throw error(404,'Campanha nao encontrada');
        const profile=readProfile(ctx).profile;campaignFacts({ctx,campaign,profile,adType:'organico'});
        const rows=scopeRows(readLedger(),ctx,campaign);
        const s=settings();return res.json({ok:true,enabled:Boolean(configReady(s)&&inPilot(ctx,campaign)),
          pilotMatched:inPilot(ctx,campaign),modelLabel:s.model||'Nao configurado',maxRequestBudgetUSD:s.maxRequest/100,
          monthlyBudgetUSD:s.ownBudget/100,globalBudgetUSD:s.globalBudget/100,canPublish:false,
          textOnly:true,requireApproval:true,agents:AGENTS,results:results(rows),
          note:'Cada agente necessita de uma confirmacao individual. Nenhum disparo externo.'});
      }catch(e){fail(res,e)}
    });
    app.post(route,async(req,res)=>{res.set('Cache-Control','no-store');if(!active())return res.status(404).json({ok:false,error:'Piloto desativado'});
      let reserved;
      try{const ctx=ctxFor(req);verifyRequest(req);const campaign=campaignFor(ctx,req.params.id);if(!campaign)throw error(404,'Campanha nao encontrada');
        if(!inPilot(ctx,campaign))throw error(403,'Campanha fora do piloto D8C explicitamente autorizado');
        if(req.body?.confirmarCusto!==true||req.body?.confirmarModo!=='UM_AGENTE')throw error(400,'Aprovacao explicita de um agente obrigatoria');
        if(campaign.state==='cancelado')throw error(409,'Campanha cancelada');
        const agent=String(req.body?.agent||'');if(!AGENTS.includes(agent))throw error(400,'Agente invalido');
        const requestId=String(req.body?.requestId||'');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw error(400,'Identificador de pedido invalido');
        const profile=readProfile(ctx).profile;
        const adType=String(req.body?.adType||'organico');
        const facts=campaignFacts({ctx,campaign,profile,adType});
        if(profile?.agents?.[agent]?.enabled===false)throw error(409,'Agente desativado');
        const s=settings();if(!configReady(s))throw error(503,'IA nao autorizada ou limites financeiros incompletos');
        const current=scopeRows(readLedger(),ctx,campaign);
        const delivered=new Map();for(const predecessor of REQUIRES[agent]){
          const rows=current.filter(r=>r.agent===predecessor&&r.status==='concluido'&&r.adType===adType);
          if(rows.length!==1)throw error(409,'Agente anterior nao concluido: '+predecessor);
          delivered.set(predecessor,{agent:predecessor,scopeKey:[ctx.type,ctx.owner,campaign.id].join('::'),text:rows[0].answer});
        }
        const request=createHandoffRequest({facts,agent,delivered,profile});
        const bytes=Buffer.byteLength(request.prompt,'utf8');if(bytes>12000)throw error(413,'Prompt acima do limite seguro; simplifique a campanha');
        const reservedCostMicroUSD=Math.ceil(bytes*s.inputPrice+s.maxOutput*s.outputPrice);
        if(reservedCostMicroUSD>s.maxRequest*10000)throw error(429,'Limite estimado por solicitacao excedido');
        reserved=locked(()=>{
          const rows=readLedger(),subset=scopeRows(rows,ctx,campaign),period=now().toISOString().slice(0,7),bs=budgetState(rows,ctx,period);
          if(subset.some(r=>r.agent===agent))throw error(409,'Agente ja executado ou reservado nesta campanha; nao repetir cobranca');
          if(bs.ownCalls>=s.ownCalls||bs.globalCalls>=s.globalCalls)throw error(429,'Cota mensal atingida');
          if(bs.own+reservedCostMicroUSD>s.ownBudget*10000||bs.global+reservedCostMicroUSD>s.globalBudget*10000)throw error(429,'Orcamento mensal estimado atingido');
          const row={id:crypto.randomUUID(),requestId,source:'D8C_TEXT_REAL_V1',agent,adType,ownerKey:ownerKey(ctx),campaignId:campaign.id,
            period,createdAt:now().toISOString(),status:'reservado',answer:'',reservedCostMicroUSD,inputBytes:bytes,inputTokens:0,outputTokens:0,totalTokens:0};
          rows.push(row);writeLedger(rows);return row;
        });
        const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),30000);let answer,usage;
        try{const response=await fetchImpl('https://api.openai.com/v1/responses',{
          method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+s.key},signal:ac.signal,
          body:JSON.stringify({model:s.model,input:request.prompt,max_output_tokens:s.maxOutput,reasoning:{effort:'none'}})
        });const body=await response.json().catch(()=>({}));if(!response.ok)throw error(502,'Provedor IA indisponivel (HTTP '+response.status+')');
          answer=safe(parseOutput(body));if(!answer)throw error(502,'Provedor retornou texto vazio');
          acceptTextDelivery({facts,agent,text:answer,request});usage=body.usage||{};
        }finally{clearTimeout(timeout)}
        const saved=locked(()=>{const rows=readLedger(),row=rows.find(r=>r.id===reserved.id);
          if(!row)throw error(409,'Reserva D8C desapareceu');row.status='concluido';row.answer=answer;
          row.inputTokens=whole(usage.input_tokens,10000000);row.outputTokens=whole(usage.output_tokens,10000000);
          row.totalTokens=whole(usage.total_tokens,10000000)||row.inputTokens+row.outputTokens;
          if(row.inputTokens>0&&row.outputTokens>0)row.actualCostMicroUSD=Math.ceil(row.inputTokens*s.inputPrice+row.outputTokens*s.outputPrice);
          writeLedger(rows);return row;
        });return res.json({ok:true,result:results([saved])[0],callsMade:1,published:false});
      }catch(e){if(reserved){try{locked(()=>{const rows=readLedger(),row=rows.find(x=>x.id===reserved.id);
        if(row){row.status='falhou';writeLedger(rows)}})}catch(logErr){console.error('[D8C LEDGER] Falha de reconciliacao; bloquear futuras chamadas')}}
        fail(res,e);
      }
    });
  }
  return {setup,ledger};
}
module.exports={createD8CTextRealPilot};
