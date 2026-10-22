'use strict';
// D8C V3.6: PROTOTIPO ISOLADO DE AUDITORIA SOMENTE LEITURA.
// NUNCA EXECUTA IA, NUNCA ALTERA DB, NAO INTEGRA AO SERVIDOR SEM NOVA REVISAO.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const STATES = new Set(['reservado','concluido','falhou']);
const TYPES = new Set(['central_produtor','vendas_produtor','vendas_lojista']);
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_BYTES = 5 * 1024 * 1024;
const fail = code => {const error=new Error(code);error.code=code;throw error};
const validMicro = v => Number.isSafeInteger(v) && v >= 0 && v <= 1000000000000;
const validText = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
const sha256 = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
function validateRow(row){
  if(!row || typeof row !== 'object' || Array.isArray(row)) fail('ROW_INVALID');
  if(!validText(row.id,128)||!validText(row.campaignId,128)||!validText(row.agent,128)) fail('ROW_IDENTIFIERS_INVALID');
  if(!validText(row.ownerKey,220)) fail('OWNER_INVALID');
  const parts=row.ownerKey.split('::');
  if(parts.length!==2||!TYPES.has(parts[0])||!/^[a-zA-Z0-9:_-]{1,128}$/.test(parts[1]) ||
     (parts[0]==='vendas_lojista' ? parts[1]==='produtor' : parts[1]!=='produtor')) fail('OWNER_INVALID');
  if(typeof row.period!=='string'||!MONTH.test(row.period)) fail('PERIOD_INVALID');
  if(typeof row.createdAt!=='string'||!Number.isFinite(Date.parse(row.createdAt))||!row.createdAt.startsWith(row.period)) fail('DATE_INVALID');
  if(!STATES.has(row.status)) fail('STATUS_UNKNOWN');
  if(!validMicro(row.reservedCostMicroUSD)) fail('RESERVE_UNKNOWN');
  if(row.actualCostMicroUSD != null && !validMicro(row.actualCostMicroUSD)) fail('ACTUAL_UNKNOWN');
  return {
    id:row.id,campaignId:row.campaignId,agent:row.agent,ownerKey:row.ownerKey,
    period:row.period,status:row.status,
    countedMicro:Math.max(row.reservedCostMicroUSD,row.actualCostMicroUSD??0)
  };
}
function readFullHistory({dataDir,maxBytes=MAX_BYTES}={}){
  if(typeof dataDir!=='string'||!path.isAbsolute(dataDir)) fail('ABSOLUTE_DATA_DIR_REQUIRED');
  if(!Number.isInteger(maxBytes)||maxBytes<2||maxBytes>MAX_BYTES) fail('FILE_LIMIT_INVALID');
  const source=path.join(dataDir,'campanha-unificada-d8a','geracoes-v1.json');
  let stat;
  try{stat=fs.lstatSync(source)}catch(e){if(e.code==='ENOENT')fail('HISTORY_MISSING');throw e}
  if(!stat.isFile()||stat.isSymbolicLink()) fail('NOT_REGULAR_FILE');
  if(stat.size<2||stat.size>maxBytes) fail('FILE_SIZE_INVALID');
  let fd;
  try{fd=fs.openSync(source,fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))}
  catch(e){if(e.code==='ELOOP')fail('NOT_REGULAR_FILE');throw e}
  let raw;
  try{
    const s1=fs.fstatSync(fd);
    if(!s1.isFile()||s1.dev!==stat.dev||s1.ino!==stat.ino||s1.size!==stat.size)fail('SOURCE_CHANGED');
    raw=fs.readFileSync(fd);
    const s2=fs.fstatSync(fd);
    if(s2.size!==s1.size||s2.mtimeMs!==s1.mtimeMs||raw.length!==s1.size)fail('SOURCE_CHANGED');
  } finally{fs.closeSync(fd)}
  if(raw.length>maxBytes)fail('FILE_SIZE_INVALID');
  let data;try{data=JSON.parse(raw.toString('utf8'))}catch{fail('JSON_INVALID')}
  if(!Array.isArray(data)||data.length>20000)fail('ROWS_INVALID');
  const ids=new Set();
  const rows=data.map(r=>{
    const item=validateRow(r);
    if(ids.has(item.id))fail('DUPLICATE_ID');ids.add(item.id);
    return item;
  });
  return {fileSha256:sha256(raw),fileBytes:raw.length,rows};
}
function summarize(snapshot,{reference}={}){
  if(!snapshot||!Array.isArray(snapshot.rows)||!snapshot.fileSha256)fail('SNAPSHOT_INVALID');
  const byPeriod={};const byStatus={reservado:0,concluido:0,falhou:0};
  const byContext={central_produtor:0,vendas_produtor:0,vendas_lojista:0};
  let allMicro=0;
  for(const row of snapshot.rows){
    byStatus[row.status]++;
    const type=row.ownerKey.split('::')[0];byContext[type]++;
    if(!byPeriod[row.period])byPeriod[row.period]={calls:0,countedMicroUSD:0};
    byPeriod[row.period].calls++;
    byPeriod[row.period].countedMicroUSD+=row.countedMicro;
    allMicro+=row.countedMicro;
    if(!Number.isSafeInteger(allMicro)||!Number.isSafeInteger(byPeriod[row.period].countedMicroUSD))fail('TOTAL_OVERFLOW');
  }
  const output={
    version:'D8C-V36-AUDITORIA-SOMENTE-LEITURA',
    fileSha256:snapshot.fileSha256,fileBytes:snapshot.fileBytes,
    totalRecords:snapshot.rows.length,byStatus,byContext,byPeriod,
    allRecordedMicroUSD:allMicro,
    externalAttestationVerified:false,providerInvoiceVerified:false,historyCompletenessProven:false,
    paidExecutionAuthorized:false,
    nextStep:'Correlacionar com o status autenticado, validar proveniencia externa e planejar corte atomico D8B/D8C.'
  };
  if(reference){
    if(!reference||typeof reference!=='object'||typeof reference.period!=='string'||!MONTH.test(reference.period)||
       !validText(reference.ownerKey,220)||!Number.isSafeInteger(reference.monthlyUsed)||!Number.isSafeInteger(reference.globalMonthlyUsed)||
       !validMicro(reference.globalReservedMicroUSD)) fail('REFERENCE_INVALID');
    const rows=snapshot.rows.filter(x=>x.period===reference.period);
    const global=rows.length;
    const own=rows.filter(x=>x.ownerKey===reference.ownerKey).length;
    const money=rows.reduce((total,row)=>total+row.countedMicro,0);
    output.referenceComparison={period:reference.period,globalCallsMatch:global===reference.globalMonthlyUsed,
      ownerCallsMatch:own===reference.monthlyUsed,globalReservedMatch:money===reference.globalReservedMicroUSD,
      matching:global===reference.globalMonthlyUsed&&own===reference.monthlyUsed&&money===reference.globalReservedMicroUSD};
  }
  return output;
}
function createAuditPreview({dataDir,producerAuthenticated=()=>false,env=process.env,reference}={}){
  if(typeof producerAuthenticated!=='function')fail('AUTH_CHECK_REQUIRED');
  function setup(app){
    app.get('/api/admin/campanha-unificada/d8b/auditoria-v36',(req,res)=>{
      res.set('Cache-Control','no-store');
      if(!producerAuthenticated(req))return res.status(401).json({ok:false,error:'unauthorized'});
      if(env.PP_D8B_AUDIT_READONLY_ENABLED!=='true')return res.status(404).json({ok:false,error:'Auditoria indisponivel'});
      try{
        const data=summarize(readFullHistory({dataDir}),{reference});
        return res.status(200).json({ok:true,audit:data});
      }catch(error){
        const code=typeof error.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:'AUDIT_FAILED';
        return res.status(409).json({ok:false,error:'HISTORICO_NAO_VERIFICADO',code,paidExecutionAuthorized:false});
      }
    });
  }
  return {setup};
}
module.exports={readFullHistory,summarize,createAuditPreview};
