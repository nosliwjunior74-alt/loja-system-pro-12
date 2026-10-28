'use strict';
// V1.15.2D-BASE: somente CRUD de rascunhos, validacao e agendamento inerte.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const TYPES=new Set(['central_produtor','vendas_produtor','vendas_lojista']);
const STATES=new Set(['rascunho','pronto_revisao','aprovado','agendado','cancelado']);
const CHANNELS=new Set(['carrossel','instagram','facebook','tiktok','whatsapp','google_business']);
const LIMIT=500;
const {previewCampaign}=require('./coordenador');
const {createAgentSettings}=require('./configuracoes-agentes');
const {createD8AI}=require('./motor-ia-d8');
const {createD8CPreview}=require('./orquestrador-d8c-v1');
const {createD8CCommunicationLab}=require('./d8c-comunicacao-lab-v1');
const {createD8CRealBridgePrep}=require('./d8c-ponte-real-prep-v1');
const {createD8CTextRealPilot}=require('./d8c-texto-real-piloto-v1');
const {createAuditPreview}=require('./auditor-d8b-v36');
function createCore({dataDir,producerAuthenticated=()=>false,clientStoreId=()=>'',getStoreById=()=>null,now=()=>new Date()}={}){
  if(!dataDir)throw Error('dataDir obrigatorio');
  const file=path.join(dataDir,'campanha-unificada-v1152d-base.json');
  const agentSettings=createAgentSettings({dataDir,now});
  function read(){try{const v=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(v)?v:[]}catch(e){if(e.code==='ENOENT')return [];throw e}}
  function write(v){fs.mkdirSync(dataDir,{recursive:true});const tmp=file+'.'+process.pid+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(v,null,2),{flag:'wx',mode:0o600});fs.renameSync(tmp,file)}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp)}}
  function context(req,type){
    if(!TYPES.has(type))return {error:400,message:'Aplicativo invalido'};
    if(type!=='vendas_lojista')return producerAuthenticated(req)?{type,owner:'produtor'}:{error:401,message:'Acesso exclusivo do Produtor'};
    const id=clientStoreId(req);if(!id)return {error:401,message:'Sessao de lojista obrigatoria'};
    const store=getStoreById(id);if(!store)return {error:403,message:'Loja nao encontrada'};
    if(store.status!=='ativo'||store.licenseStatus!=='ativa')return {error:403,message:'Loja ou licenca inativa'};
    return {type,owner:String(id)};
  }
  function clean(raw,previous){
    const s=(name,max)=>String(raw[name]??previous?.[name]??'').trim().slice(0,max);
    const title=s('title',100),objective=s('objective',1500),subject=s('subject',200);
    if(!title||!objective)throw Error('Titulo e objetivo obrigatorios');
    const channels=raw.channels===undefined?(previous?.channels||[]):raw.channels;
    if(!Array.isArray(channels)||channels.length>CHANNELS.size||channels.some(x=>!CHANNELS.has(x)))throw Error('Canais invalidos');
    const scheduleAt=s('scheduleAt',40);if(scheduleAt&&!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(scheduleAt))throw Error('Agendamento deve usar ISO UTC');
    if(scheduleAt&&!Number.isFinite(Date.parse(scheduleAt)))throw Error('Data invalida');
    const timezone=s('timezone',64)||'America/Sao_Paulo';
    try{new Intl.DateTimeFormat('en',{timeZone:timezone})}catch{throw Error('Fuso horario invalido')}
    const state=s('state',30)||'rascunho';if(!STATES.has(state))throw Error('Estado invalido');
    if(state==='agendado'&&!scheduleAt)throw Error('Agendamento requer data');
    if(state==='agendado'&&Date.parse(scheduleAt)<=+now())throw Error('Agendamento deve ser futuro');
    if(previous?.state==='cancelado'&&state!=='cancelado')throw Error('Campanha cancelada nao pode ser reativada');
    return {title,objective,subject,channels:[...new Set(channels)],timezone,scheduleAt,state,aiSettings:structuredConfig(raw.aiSettings??previous?.aiSettings),campaignBrief:structuredConfig(raw.campaignBrief??previous?.campaignBrief)};
  }
  function structuredConfig(obj){if(obj==null)return {};if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('Configuracao invalida');const value=JSON.stringify(obj);if(value.length>12000)throw Error('Configuracao excede o limite');return JSON.parse(value)}
  const d8AI=createD8AI({dataDir,context,readCampaigns:read,readProfile:c=>agentSettings.get(c)});
  const d8cPreview=createD8CPreview({context,readCampaigns:read,readProfile:c=>agentSettings.get(c),getStoreById});
  // V3.6: consulta administrativa read-only, nao modifica motor D8B ou D8C.
  const d8bAudit=createAuditPreview({dataDir,producerAuthenticated});
  const d8cCommunicationLab=createD8CCommunicationLab({context,readCampaigns:read,readProfile:c=>agentSettings.get(c),getStoreById});
  const d8cRealBridgePrep=createD8CRealBridgePrep({context,readCampaigns:read,readProfile:c=>agentSettings.get(c),getStoreById});
  const d8cTextRealPilot=createD8CTextRealPilot({dataDir,context,readCampaigns:read,readProfile:c=>agentSettings.get(c),getStoreById});
  function setup(app){
    d8AI.setup(app);
    d8cPreview.setup(app);
    d8cCommunicationLab.setup(app);
    d8cRealBridgePrep.setup(app);
    d8cTextRealPilot.setup(app);
    d8bAudit.setup(app);
    // D3 perfis sao propriedade exclusiva do contexto autenticado.
    app.get('/api/campanha-unificada/v1/:type/configuracao-ia',(req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});try{return res.json({ok:true,...agentSettings.get(c)})}catch(e){return res.status(500).json({error:'Erro ao consultar perfil'})}});
    app.put('/api/campanha-unificada/v1/:type/configuracao-ia',(req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});try{return res.json({ok:true,...agentSettings.put(c,req.body||{})})}catch(e){if(/^(Configuracao|Campo|Texto|Agente|Ativacao|Instrucoes)/.test(e.message))return res.status(400).json({error:e.message});return res.status(500).json({error:'Erro ao salvar perfil'})}});

    app.get('/api/campanha-unificada/v1/:type', (req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});return res.json({ok:true,items:read().filter(x=>x.type===c.type&&x.owner===c.owner),externalPublicationEnabled:false})});
    app.post('/api/campanha-unificada/v1/:type',(req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});try{const all=read();if(all.length>=LIMIT)return res.status(409).json({error:'Limite de registros atingido'});const cleaned=clean(req.body||{}),stamp=now().toISOString();const item={id:crypto.randomUUID(),type:c.type,owner:c.owner,...cleaned,createdAt:stamp,updatedAt:stamp,publishedAt:null};all.push(item);write(all);res.status(201).json({item})}catch(e){res.status(400).json({error:e.message})}});
    app.put('/api/campanha-unificada/v1/:type/:id',(req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});try{const all=read(),ix=all.findIndex(x=>x.id===req.params.id&&x.type===c.type&&x.owner===c.owner);if(ix<0)return res.status(404).json({error:'Campanha nao encontrada'});const item={...all[ix],...clean(req.body||{},all[ix]),updatedAt:now().toISOString()};all[ix]=item;write(all);res.json({item})}catch(e){res.status(400).json({error:e.message})}});
    app.get('/api/campanha-unificada/v1/:type/:id/previa',(req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});try{const item=read().find(x=>x.id===req.params.id&&x.type===c.type&&x.owner===c.owner);if(!item)return res.status(404).json({error:'Campanha nao encontrada'});const store=c.type==='vendas_lojista'?getStoreById(c.owner):null;const settings=agentSettings.get(c);return res.json({ok:true,preview:previewCampaign(item,{store,agentProfile:settings.profile,profileUpdatedAt:settings.updatedAt})})}catch(e){return res.status(400).json({error:e.message})}});
    app.post('/api/campanha-unificada/v1/:type/:id/rodar',(req,res)=>{const c=context(req,req.params.type);if(c.error)return res.status(c.error).json({error:c.message});res.status(409).json({error:'Publicacao externa desativada nesta etapa. Nenhum disparo realizado.'})});
  }
  return {setup,read,clean,context,file};
}
module.exports={createCore,TYPES};
