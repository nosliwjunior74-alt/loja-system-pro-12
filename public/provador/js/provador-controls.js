(function(){
  const state={busy:false};
  const PENDING_KEY='provador_remote_pending_command_v1';
  const PENDING_SOURCE_KEY='provador_remote_pending_source_v1';

  function isProvadorPage(){
    const page=String(location.pathname || '').split('/').pop().toLowerCase();
    return page==='provador.html';
  }

  function returnToProvador(command,source='local'){
    try{
      sessionStorage.setItem(PENDING_KEY,String(command || ''));
      sessionStorage.setItem(PENDING_SOURCE_KEY,String(source || 'local'));
    }catch(e){}

    if(window.ProNavigation?.go){
      window.ProNavigation.go('provador.html');
      return true;
    }

    const url=new URL('provador.html',location.href);
    const slug=String(new URLSearchParams(location.search).get('loja') || '').trim();
    if(slug) url.searchParams.set('loja',slug);
    location.href=url.toString();
    return true;
  }

    async function looks(){
    if(typeof window.carregarLooksOnline!=='function') return [];
    const items=await window.carregarLooksOnline();
    return Array.isArray(items)?items:[];
  }

  function selected(){
    try{
      return window.AppStore?.getSelected?.() || null;
    }catch(e){
      return null;
    }
  }

  async function move(delta){
    if(state.busy) return false;
    state.busy=true;
    try{
      const items=await looks();
      if(!items.length) return false;

      const atual=selected();
      let index=items.findIndex(item=>
        atual && (
          String(item.id ?? '')===String(atual.id ?? '') ||
          String(item.nome ?? '')===String(atual.nome ?? '')
        )
      );

      if(index<0) index=0;
      const next=(index+delta+items.length)%items.length;
      const item=items[next];

      if(typeof window.selecionarLook==='function'){
        await window.selecionarLook(item.id || item.nome);
        return true;
      }
      return false;
    }finally{
      state.busy=false;
    }
  }

  function looksPanel(show){
    const painel=document.getElementById('looksPanel');
    if(!painel) return false;
    painel.style.display=show?'grid':'none';
    return true;
  }

  async function execute(command,source='local'){
    const cmd=String(command||'').trim().toLowerCase();
    const commandSource=String(source||'local').trim().toLowerCase();

    switch(cmd){
      case 'next':
      case 'next-look':
        if(!isProvadorPage()) return returnToProvador('next-look',commandSource);
        return move(1);

      case 'previous':
      case 'previous-look':
        if(!isProvadorPage()) return returnToProvador('previous-look',commandSource);
        return move(-1);

      case 'open-looks':
        return looksPanel(true);

      case 'close-looks':
        return looksPanel(false);

      case 'toggle-looks':
        if(!isProvadorPage()) return returnToProvador('toggle-looks',commandSource);
        if(typeof window.toggleLooks==='function'){
          window.toggleLooks();
          return true;
        }
        return false;

      case 'photo':
        if(!isProvadorPage()) return returnToProvador('photo',commandSource);
        if(commandSource==='remote' && window.CameraModule?.capturePhotoDataUrl){
          const dataUrl=window.CameraModule.capturePhotoDataUrl('poseCanvas');
          if(!dataUrl) return false;
          window.dispatchEvent(new CustomEvent('provador:remote-photo-captured',{
            detail:{dataUrl}
          }));
          return true;
        }
        if(typeof window.fotoLook==='function'){
          window.fotoLook();
          return true;
        }
        return false;

      case 'whatsapp':
        if(typeof window.enviarWhats==='function'){
          window.enviarWhats();
          return true;
        }
        return false;

      case 'catalog':
        if(window.ProNavigation){
          window.ProNavigation.go('catalogo.html');
          return true;
        }
        return false;

      case 'rest':
        if(window.ProNavigation){
          window.ProNavigation.go('descanso.html');
          return true;
        }
        return false;

      case 'tracking':
        if(window.CameraModule?.toggleTracking){
          window.CameraModule.toggleTracking();
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  async function runPending(){
    if(!isProvadorPage()) return false;

    let cmd='';
    let source='local';
    try{
      cmd=String(sessionStorage.getItem(PENDING_KEY) || '').trim();
      source=String(sessionStorage.getItem(PENDING_SOURCE_KEY) || 'local').trim().toLowerCase();
      if(cmd) sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_SOURCE_KEY);
    }catch(e){}

    if(!cmd) return false;
    return execute(cmd,source);
  }

  window.ProvadorControls={
    execute,
    runPending,
    nextLook:()=>execute('next-look'),
    previousLook:()=>execute('previous-look'),
    openLooks:()=>execute('open-looks'),
    closeLooks:()=>execute('close-looks'),
    toggleLooks:()=>execute('toggle-looks'),
    photo:()=>execute('photo'),
    whatsapp:()=>execute('whatsapp'),
    catalog:()=>execute('catalog'),
    rest:()=>execute('rest'),
    tracking:()=>execute('tracking')
  };
})();