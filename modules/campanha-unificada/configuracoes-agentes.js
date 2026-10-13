'use strict';
// D3: perfis independentes; nenhuma chamada externa, chave ou envio.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AGENTS = ['coordenador','estrategia','redacao','design','video','conformidade','publicacao','analise'];
const PROFILES = {
  central_produtor: 'Comunicados e ofertas internas destinados a lojistas autorizados',
  vendas_produtor: 'Divulgacao comercial do Provador Pro para novos lojistas',
  vendas_lojista: 'Divulgacao de roupas, looks e colecoes da loja autenticada'
};
function defaults(type) {
  return {version:'V1.15.2D-D3', objective:PROFILES[type], tone:'profissional',
    audience:'', instructions:'', agents:Object.fromEntries(AGENTS.map(name=>[name,{enabled:true,instructions:''}])),
    requireApproval:true, externalAiEnabled:false, externalPublicationEnabled:false, scheduleExecutionEnabled:false};
}
function validate(input, type) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Configuracao invalida');
  const allowed = new Set(['objective','tone','audience','instructions','agents']);
  if (Object.keys(input).some(k=>!allowed.has(k))) throw Error('Campo nao permitido');
  const base=defaults(type);
  for (const field of ['objective','tone','audience','instructions']) {
    if (input[field] === undefined) continue;
    if (typeof input[field] !== 'string') throw Error('Texto invalido: '+field);
    const limits={objective:500,tone:80,audience:300,instructions:1500};
    if (input[field].length > limits[field]) throw Error('Texto acima do limite: '+field);
    base[field]=input[field].trim();
  }
  if (input.agents !== undefined) {
    if (!input.agents || typeof input.agents !== 'object' || Array.isArray(input.agents)) throw Error('Agentes invalidos');
    if (Object.keys(input.agents).some(a=>!AGENTS.includes(a))) throw Error('Agente nao reconhecido');
    for(const [name,cfg] of Object.entries(input.agents)) {
      if (!cfg || typeof cfg!=='object' || Array.isArray(cfg) || Object.keys(cfg).some(k=>!['enabled','instructions'].includes(k))) throw Error('Config de agente invalida');
      if (cfg.enabled!==undefined && typeof cfg.enabled!=='boolean') throw Error('Ativacao invalida');
      if (cfg.instructions!==undefined && (typeof cfg.instructions!=='string'||cfg.instructions.length>800)) throw Error('Instrucoes invalidas');
      base.agents[name]={enabled:cfg.enabled??true,instructions:(cfg.instructions??'').trim()};
    }
  }
  // Controles de seguranca sao exclusivamente do servidor, jamais configuraveis via cliente.
  return base;
}
function createAgentSettings({dataDir,now=()=>new Date()}={}) {
  if (!dataDir) throw Error('dataDir obrigatorio');
  const file=path.join(dataDir,'campanha-unificada-v1152d-d3-perfis.json');
  const key=(ctx)=>ctx.type+'::'+ctx.owner;
  function load() {
    try {const obj=JSON.parse(fs.readFileSync(file,'utf8'));if(!obj || typeof obj!=='object'||Array.isArray(obj))throw Error('Dados de perfis invalidos');return obj}
    catch(e){if(e.code==='ENOENT')return {};throw e}
  }
  function save(data) {
    fs.mkdirSync(dataDir,{recursive:true});const temp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
    try {fs.writeFileSync(temp,JSON.stringify(data,null,2),{encoding:'utf8',flag:'wx',mode:0o600});fs.renameSync(temp,file)}
    finally {if(fs.existsSync(temp))fs.unlinkSync(temp)}
  }
  function get(ctx) {const obj=load();return {type:ctx.type,owner:ctx.owner,profile:obj[key(ctx)]?.profile || defaults(ctx.type),updatedAt:obj[key(ctx)]?.updatedAt||null}}
  function put(ctx,raw) {
    const profile=validate(raw,ctx.type);const all=load();const updatedAt=now().toISOString();all[key(ctx)]={profile,updatedAt};save(all);
    return {type:ctx.type,owner:ctx.owner,profile,updatedAt};
  }
  return {get,put,file};
}
module.exports={createAgentSettings,defaults,validate,AGENTS};
