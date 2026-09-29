(function(){
  const q=new URLSearchParams(location.search);
  const sessionId=String(q.get('session')||'').trim();
  const slug=String(q.get('loja')||'').trim().toLowerCase();
  const h=new URLSearchParams(String(location.hash||'').replace(/^#/,''));
  const TOKEN_STORAGE_KEY='provador_remote_controller_token_v1_'+sessionId;
  let token=String(h.get('token')||'').trim();

  if(token){
    try{ sessionStorage.setItem(TOKEN_STORAGE_KEY,token); }catch(e){}
  }else{
    try{ token=String(sessionStorage.getItem(TOKEN_STORAGE_KEY)||'').trim(); }catch(e){}
  }

  const statusEl=document.getElementById('remoteStatus');
  const storeNameEl=document.getElementById('storeName');
  const storeLogoEl=document.getElementById('storeLogo');
  const buttons=[...document.querySelectorAll('[data-command]')];
  const photoPanel=document.getElementById('remotePhotoPanel');
  const photoPreview=document.getElementById('remotePhotoPreview');
  const photoSaveBtn=document.getElementById('remotePhotoSaveBtn');
  const photoWhatsBtn=document.getElementById('remotePhotoWhatsBtn');
  const photoClearBtn=document.getElementById('remotePhotoClearBtn');
  // PROVADOR PRO CONTROLE CELULAR COMPLETO V3
  const remoteLooksGrid=document.getElementById('remoteLooksGrid');
  const remoteSelectedLook=document.getElementById('remoteSelectedLook');
  let remoteLooks=[];
  let selectedLookValue='';
  let busy=false;
  let photoDataUrl='';
  let photoCreatedAt=0;
  let photoTimer=null;

  function status(text,ok){
    if(!statusEl) return;
    statusEl.textContent=text;
    statusEl.classList.toggle('is-ok',ok===true);
    statusEl.classList.toggle('is-error',ok===false);
  }

  function enable(value){
    for(const button of document.querySelectorAll('[data-command],[data-look-value]')){
      button.disabled=!value;
    }
  }

  function parseLookSource(value){
    let current=value;
    while(typeof current==='string'){
      try{ current=JSON.parse(current); }
      catch(e){ return []; }
    }
    return Array.isArray(current)?current:[];
  }

  function lookValue(item,index){
    return String(item?.id ?? item?.nome ?? item?.name ?? index);
  }

  function lookName(item,index){
    return String(item?.nome ?? item?.name ?? ('Look '+(index+1)));
  }

  function lookImage(item){
    return String(item?.imagem ?? item?.image ?? item?.imageUrl ?? item?.foto ?? item?.url ?? '');
  }

  function setSelectedLook(value,name){
    selectedLookValue=String(value ?? '');
    if(remoteSelectedLook){
      remoteSelectedLook.textContent=name
        ? 'Selecionado: '+name+' • toque PROVAR LOOK'
        : 'Escolha um look abaixo.';
    }
    for(const card of document.querySelectorAll('[data-look-value]')){
      card.classList.toggle('is-selected',String(card.dataset.lookValue||'')===selectedLookValue);
    }
  }

  function renderLooks(items){
    remoteLooks=Array.isArray(items)?items:[];
    if(!remoteLooksGrid) return;
    remoteLooksGrid.innerHTML='';
    if(!remoteLooks.length){
      remoteLooksGrid.innerHTML='<div class="remote-empty">Nenhum look disponível nesta loja.</div>';
      return;
    }

    remoteLooks.forEach((item,index)=>{
      const value=lookValue(item,index);
      const name=lookName(item,index);
      const image=lookImage(item);
      const button=document.createElement('button');
      button.type='button';
      button.className='remote-look-card';
      button.dataset.lookValue=value;

      if(image){
        const img=document.createElement('img');
        img.src=image;
        img.alt=name;
        button.appendChild(img);
      }

      const label=document.createElement('span');
      label.className='remote-look-name';
      label.textContent=name;
      button.appendChild(label);

      button.addEventListener('click',async()=>{
        const ok=await send('select-look',value);
        if(ok){
          setSelectedLook(value,name);
          status('Look selecionado na TV. Toque PROVAR LOOK.',true);
        }
      });

      remoteLooksGrid.appendChild(button);
    });

    enable(!!sessionId && !!token);
  }

  async function loadStore(){
    if(!slug) return;
    try{
      const r=await fetch('/api/public/store/'+encodeURIComponent(slug),{cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      if(!r.ok || !data.store) return;
      const store=data.store;
      if(storeNameEl) storeNameEl.textContent=store.name||'Controle do Provador';
      if(storeLogoEl){
        if(store.logo){
          storeLogoEl.src=store.logo;
          storeLogoEl.hidden=false;
        }else{
          storeLogoEl.hidden=true;
        }
      }
      if(store.color) document.documentElement.style.setProperty('--brand-color',store.color);

      const sources=[store.looks,store.estoque,store.products,store.roupas];
      let looks=[];
      for(const source of sources){
        const parsed=parseLookSource(source);
        if(parsed.length){
          looks=parsed;
          break;
        }
      }
      renderLooks(looks);
    }catch(e){
      if(remoteLooksGrid){
        remoteLooksGrid.innerHTML='<div class="remote-empty">Não foi possível carregar os looks.</div>';
      }
    }
  }

  function hidePhoto(){
    photoDataUrl='';
    if(photoPreview) photoPreview.removeAttribute('src');
    if(photoPanel) photoPanel.hidden=true;
  }

  function showPhoto(photo){
    const dataUrl=String(photo?.dataUrl || '');
    const createdAt=Number(photo?.createdAt || 0);
    if(!dataUrl || !createdAt) return false;
    photoDataUrl=dataUrl;
    photoCreatedAt=createdAt;
    if(photoPreview) photoPreview.src=dataUrl;
    if(photoPanel) photoPanel.hidden=false;
    status('Foto do look pronta no celular',true);
    return true;
  }

  async function pollPhoto(){
    if(!sessionId || !token) return;

    try{
      const r=await fetch(
        '/api/public/provador-remote/'+encodeURIComponent(sessionId)+'/photo?after='+encodeURIComponent(photoCreatedAt),
        {
          headers:{'x-provador-controller-token':token},
          cache:'no-store'
        }
      );
      const data=await r.json().catch(()=>({}));

      if(!r.ok){
        if(r.status===404 || r.status===403){
          clearInterval(photoTimer);
          photoTimer=null;
        }
        return;
      }

      if(data.photo) showPhoto(data.photo);
    }catch(e){}
  }

  if(photoSaveBtn){
    photoSaveBtn.addEventListener('click',()=>{
      if(!photoDataUrl) return;
      const a=document.createElement('a');
      a.href=photoDataUrl;
      a.download='foto-look.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      status('Foto pronta para salvar no celular',true);
    });
  }

  async function photoFile(){
    if(!photoDataUrl) return null;
    const response=await fetch(photoDataUrl);
    const blob=await response.blob();
    return new File([blob],'foto-look.png',{type:blob.type || 'image/png'});
  }

  if(photoWhatsBtn){
    photoWhatsBtn.addEventListener('click',async()=>{
      if(!photoDataUrl) return;
      status('Abrindo compartilhamento...',true);
      try{
        const file=await photoFile();
        const shareData={title:'Foto do look',text:'Meu look no Provador Pro',files:[file]};
        if(navigator.share && (!navigator.canShare || navigator.canShare(shareData))){
          await navigator.share(shareData);
          status('Escolha o WhatsApp para enviar a foto',true);
          return;
        }
      }catch(err){
        if(err?.name==='AbortError') return;
      }
      status('No modo local, use SALVAR NO CELULAR e compartilhe pelo WhatsApp',true);
      return;
    });
  }

  if(photoClearBtn){
    photoClearBtn.addEventListener('click',async()=>{
      if(!photoDataUrl) return;
      hidePhoto();
      status('Preparando nova foto...',true);
      await send('photo');
    });
  }

  async function send(command,value=''){
    if(busy || !sessionId || !token) return false;
    busy=true;
    enable(false);
    status('Enviando comando...',true);
    try{
      const payload={token,command};
      if(value!==undefined && value!==null && String(value)!==''){
        payload.value=String(value);
      }
      const r=await fetch('/api/public/provador-remote/'+encodeURIComponent(sessionId)+'/command',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Falha ao enviar comando.');
      status('Conectado ao Provador',true);
      return true;
    }catch(err){
      status(err?.message||'Controle indisponivel.',false);
      return false;
    }finally{
      busy=false;
      enable(!!sessionId && !!token);
    }
  }

  for(const button of buttons){
    button.addEventListener('click',()=>send(button.dataset.command));
  }

  if(!sessionId || !token){
    enable(false);
    status('Link de controle invalido ou incompleto.',false);
    return;
  }

  history.replaceState(null,'',location.pathname+location.search);
  enable(true);
  status('Conectado ao Provador',true);
  loadStore();
  photoTimer=setInterval(pollPhoto,1000);
  pollPhoto();
})();
