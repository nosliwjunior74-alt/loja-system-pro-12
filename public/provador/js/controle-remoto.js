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
    for(const button of buttons) button.disabled=!value;
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
    }catch(e){}
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
      const a=document.createElement('a');
      a.href=photoDataUrl;
      a.download='foto-look.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      const text=encodeURIComponent('Foto do meu look no Provador Pro. A imagem foi salva no celular para anexar.');
      window.open('https://wa.me/?text='+text,'_blank','noopener');
    });
  }

  async function send(command){
    if(busy || !sessionId || !token) return;
    busy=true;
    enable(false);
    status('Enviando comando...',true);
    try{
      const r=await fetch('/api/public/provador-remote/'+encodeURIComponent(sessionId)+'/command',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token,command})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(data.error||'Falha ao enviar comando.');
      status('Conectado ao Provador',true);
    }catch(err){
      status(err?.message||'Controle indisponivel.',false);
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