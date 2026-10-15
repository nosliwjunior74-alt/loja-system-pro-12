'use strict';
// D7.1 - Midias privadas por contexto; sem IA, publicacao nem acesso publico.
// Upload binario com streams nativos do Node. Nao depende de multipart/multer.
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {once}=require('events');
const MAX_IMAGE=10*1024*1024;
const MAX_VIDEO=60*1024*1024;
const MAX_OWNER_BYTES=250*1024*1024;
const MAX_OWNER_ITEMS=100;
const ALLOWED_TYPES=new Set(['central_produtor','vendas_produtor','vendas_lojista']);
const EXT={ 'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif',
  'video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov' };
const isVideo=mime=>mime.startsWith('video/');
const error=(code,message)=>Object.assign(new Error(message),{httpStatus:code});

function detectedMime(head){
  if(head.length>=3&&head[0]===255&&head[1]===216&&head[2]===255)return 'image/jpeg';
  if(head.length>=8&&head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(head.length>=6&&['GIF87a','GIF89a'].includes(head.toString('ascii',0,6)))return 'image/gif';
  if(head.length>=12&&head.toString('ascii',0,4)==='RIFF'&&head.toString('ascii',8,12)==='WEBP')return 'image/webp';
  if(head.length>=12&&head.toString('ascii',4,8)==='ftyp'){
    const brand=head.toString('ascii',8,12);
    return brand==='qt  '?'video/quicktime':'video/mp4';
  }
  if(head.length>=4&&head.subarray(0,4).equals(Buffer.from([26,69,223,163])))return 'video/webm';
  return null;
}
function safeName(raw){
  let name;
  try{name=decodeURIComponent(String(raw||''))}catch{throw error(400,'Nome do arquivo invalido')}
  name=name.replace(/[\\/\x00-\x1f\x7f]/g,'').trim().slice(0,100);
  if(!name||name==='.'||name==='..')name='midia';
  return name;
}
function createMediaCore({dataDir,campaignCore}={}){
  if(!dataDir||!campaignCore||typeof campaignCore.context!=='function'||typeof campaignCore.read!=='function')throw Error('D7 requer dataDir e o core da campanha');
  const root=path.join(dataDir,'campanha-midias-d7-private');
  const index=path.join(root,'midias-v1.json');
  const rootFiles=path.join(root,'arquivos');
  function read(){try{const parsed=JSON.parse(fs.readFileSync(index,'utf8'));if(!Array.isArray(parsed))throw Error('Indice D7 invalido');return parsed}catch(e){if(e.code==='ENOENT')return [];throw e}}
  function write(records){fs.mkdirSync(root,{recursive:true,mode:0o700});const temp=index+'.'+crypto.randomUUID()+'.tmp';try{fs.writeFileSync(temp,JSON.stringify(records,null,2),{flag:'wx',mode:0o600});fs.renameSync(temp,index)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}}
  const ownerKey=c=>crypto.createHash('sha256').update(c.type+'\u0000'+c.owner).digest('hex');
  const dirFor=c=>path.join(rootFiles,c.type,ownerKey(c));
  function context(req,res){
    const c=campaignCore.context(req,req.params.type);
    if(c.error){res.status(c.error).json({ok:false,error:c.message});return null}
    // A identidade real permanece a da sessao autenticada. O slug da pagina e
    // apenas uma verificacao adicional: nunca escolhe o proprietario da midia.
    if(c.type==='vendas_lojista'){
      const expected=String(req.query?.loja||'').trim();
      const actual=String(req.session?.clientStoreSlug||'').trim();
      const authenticatedId=String(req.session?.clientStoreId||'');
      if(!expected||!actual||expected!==actual||authenticatedId!==String(c.owner)){
        res.status(409).json({ok:false,error:'Sessao da loja diferente da aba. Reabra a loja correta e entre novamente.'});
        return null;
      }
    }
    return c;
  }
  function mutation(req){
    // Header nao-simples + Origin exigidos: nao aceitar formularios de sites terceiros.
    if(req.get('x-pp-d7-action')!=='1')throw error(403,'Requisicao de alteracao nao autorizada');
    const origin=req.get('origin');
    if(!origin)throw error(403,'Origem da requisicao ausente');
    let url;try{url=new URL(origin)}catch{throw error(403,'Origem invalida')}
    if(url.host.toLowerCase()!==String(req.get('host')||'').toLowerCase() ||
       url.protocol!==`${req.protocol}:`)throw error(403,'Origem diferente do sistema');
  }
  const itemsOf=(rows,c)=>rows.filter(r=>r.type===c.type&&r.owner===c.owner);
  const publicRecord=r=>({id:r.id,name:r.name,mime:r.mime,kind:r.kind,bytes:r.bytes,campaignId:r.campaignId||'',createdAt:r.createdAt,source:'propria'});
  function verifyCampaign(c,id){if(!id)return;const rows=campaignCore.read();if(!rows.some(x=>x.id===id&&x.type===c.type&&x.owner===c.owner))throw error(404,'Campanha nao encontrada neste aplicativo')}
  function record(req,c){const id=String(req.params.id||'');if(!/^[a-f0-9-]{36}$/i.test(id))throw error(404,'Midia nao encontrada');const r=read().find(x=>x.id===id&&x.type===c.type&&x.owner===c.owner);if(!r)throw error(404,'Midia nao encontrada');return r}
  function fileFor(r,c){return path.join(dirFor(c),r.id+EXT[r.mime])}
  function fail(res,e){if(res.headersSent)return;res.status(e.httpStatus||500).json({ok:false,error:e.httpStatus?e.message:'Erro interno na biblioteca de midias'})}
  function setup(app){
    app.get('/api/campanha-midias-d7/v1/:type', (req,res)=>{
      const c=context(req,res);if(!c)return;
      try{const list=itemsOf(read(),c);res.json({ok:true,items:list.map(publicRecord).reverse(),quota:{maxFiles:MAX_OWNER_ITEMS,maxBytes:MAX_OWNER_BYTES,usedBytes:list.reduce((n,r)=>n+r.bytes,0)},aiGenerationEnabled:false,externalPublicationEnabled:false})}catch(e){fail(res,e)}
    });
    app.post('/api/campanha-midias-d7/v1/:type/upload',async(req,res)=>{
      const c=context(req,res);if(!c)return;
      let temp='';
      try{
        mutation(req);
        if(!/^application\/octet-stream(?:\s*;.*)?$/i.test(req.get('content-type')||''))throw error(415,'Envie arquivo binario; multipart nao e utilizado nesta etapa');
        const name=safeName(req.get('x-pp-d7-file-name'));
        const claimedKind=req.get('x-pp-d7-kind');
        if(!['imagem','video'].includes(claimedKind))throw error(400,'Tipo de midia invalido');
        const max=claimedKind==='imagem'?MAX_IMAGE:MAX_VIDEO;
        const length=req.get('content-length');if(length&&(!/^\d+$/.test(length)||Number(length)>max))throw error(413,'Arquivo maior que o limite permitido');
        const campaignId=String(req.query.campaignId||'');
        if(campaignId&&!/^[0-9a-f-]{36}$/i.test(campaignId))throw error(400,'ID de campanha invalido');
        verifyCampaign(c,campaignId);
        const rows=itemsOf(read(),c);
        if(rows.length>=MAX_OWNER_ITEMS)throw error(409,'Limite de arquivos desta biblioteca atingido');
        if(rows.reduce((n,r)=>n+r.bytes,0)>=MAX_OWNER_BYTES)throw error(409,'Espaco disponivel esgotado');
        const dir=dirFor(c);fs.mkdirSync(dir,{recursive:true,mode:0o700});
        temp=path.join(dir,'.upload-'+crypto.randomUUID()+'.tmp');
        const writer=fs.createWriteStream(temp,{flags:'wx',mode:0o600});
        let writerError=null;writer.on('error',e=>{writerError=e});
        let bytes=0,head=Buffer.alloc(0);
        try{
          for await(const chunk of req){
            bytes+=chunk.length;
            if(bytes>max)throw error(413,'Arquivo maior que o limite permitido');
            if(head.length<48)head=Buffer.concat([head,chunk.subarray(0,48-head.length)]);
            if(writerError)throw writerError;
            if(!writer.write(chunk))await once(writer,'drain');
          }
          if(writerError)throw writerError;
          writer.end();await once(writer,'finish');
        }catch(e){writer.destroy();throw e}
        if(bytes===0)throw error(400,'Arquivo vazio');
        const mime=detectedMime(head);
        if(!mime||!EXT[mime]||(isVideo(mime)!==(claimedKind==='video')))throw error(415,'Formato de arquivo nao permitido ou diferente do declarado');
        // Revalida apos o streaming para impedir exceder limite em concorrencia.
        const all=read(),current=itemsOf(all,c);
        if(current.length>=MAX_OWNER_ITEMS||current.reduce((n,r)=>n+r.bytes,0)+bytes>MAX_OWNER_BYTES)throw error(409,'Cota de armazenamento atingida');
        verifyCampaign(c,campaignId);
        const id=crypto.randomUUID(),dest=path.join(dir,id+EXT[mime]);
        fs.renameSync(temp,dest);temp='';
        const record={id,type:c.type,owner:c.owner,name,mime,kind:claimedKind,bytes,campaignId,createdAt:new Date().toISOString()};
        try{write([...all,record])}catch(e){fs.rmSync(dest,{force:true});throw e}
        res.status(201).json({ok:true,item:publicRecord(record)});
      }catch(e){fail(res,e)}finally{if(temp){try{fs.rmSync(temp,{force:true})}catch{}}}
    });
    app.put('/api/campanha-midias-d7/v1/:type/:id/campanha',(req,res)=>{
      const c=context(req,res);if(!c)return;
      try{mutation(req);const r=record(req,c),campaignId=String(req.body?.campaignId||'');if(campaignId&&!/^[a-f0-9-]{36}$/i.test(campaignId))throw error(400,'ID de campanha invalido');verifyCampaign(c,campaignId);
        const all=read();const item=all.find(x=>x.id===r.id&&x.type===c.type&&x.owner===c.owner);item.campaignId=campaignId;write(all);res.json({ok:true,item:publicRecord(item)});
      }catch(e){fail(res,e)}
    });
    app.delete('/api/campanha-midias-d7/v1/:type/:id',(req,res)=>{
      const c=context(req,res);if(!c)return;
      try{mutation(req);const r=record(req,c);const p=fileFor(r,c);const all=read();write(all.filter(x=>x.id!==r.id));try{fs.rmSync(p,{force:true})}catch(e){console.error('[D7] Falha ao eliminar arquivo',e.message)}res.json({ok:true})}catch(e){fail(res,e)}
    });
    app.get('/api/campanha-midias-d7/v1/:type/:id/arquivo',(req,res)=>{
      const c=context(req,res);if(!c)return;
      try{
        const r=record(req,c),p=fileFor(r,c),stat=fs.statSync(p);
        if(!stat.isFile())throw error(404,'Arquivo indisponivel');
        const download=String(req.query.download||'')==='1';
        const clean=safeName(r.name).replace(/[";]/g,'_');
        res.set('Content-Type',r.mime);res.set('X-Content-Type-Options','nosniff');res.set('Cross-Origin-Resource-Policy','same-origin');res.set('Cache-Control','private, no-store');
        res.set('Content-Security-Policy',"default-src 'none'; sandbox");
        res.set('Content-Disposition',(download?'attachment':'inline')+'; filename="midia'+EXT[r.mime]+'"; filename*=UTF-8\'\''+encodeURIComponent(clean));
        res.set('Accept-Ranges','bytes');
        const range=String(req.get('range')||'');let start=0,end=stat.size-1;
        if(range){
          const match=/^bytes=(\d*)-(\d*)$/.exec(range);
          if(!match||(!match[1]&&!match[2])){res.status(416).set('Content-Range',`bytes */${stat.size}`).end();return}
          if(match[1]){start=Number(match[1]);end=match[2]?Number(match[2]):end}
          else{const suffix=Number(match[2]);start=Math.max(0,stat.size-suffix)}
          if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=stat.size||end<start){res.status(416).set('Content-Range',`bytes */${stat.size}`).end();return}
          end=Math.min(end,stat.size-1);res.status(206).set('Content-Range',`bytes ${start}-${end}/${stat.size}`);
        }
        res.set('Content-Length',String(end-start+1));
        const stream=fs.createReadStream(p,{start,end});stream.on('error',()=>{if(!res.headersSent)res.status(500).end();else res.destroy()});stream.pipe(res);
      }catch(e){fail(res,e)}
    });
  }
  return {setup,read,detectedMime,root};
}
module.exports={createMediaCore,detectedMime};
