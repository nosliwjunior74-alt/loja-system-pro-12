(function(){
  const state={
    session:null,
    lastCommandId:0,
    timer:null,
    polling:false
  };

  const STORAGE_KEY='provador_mobile_remote_session_v1';

  function saveSession(){
    try{
      if(!state.session){
        sessionStorage.removeItem(STORAGE_KEY);
        return;
      }
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify({
        session:state.session,
        lastCommandId:state.lastCommandId
      }));
    }catch(e){}
  }

  function restoreSession(){
    try{
      const raw=sessionStorage.getItem(STORAGE_KEY);
      if(!raw) return false;

      const saved=JSON.parse(raw);
      const session=saved?.session;
      const slug=getSlug();

      if(!session?.id || !session?.tvToken || !session?.slug){
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }

      if(slug && String(session.slug).toLowerCase()!==slug){
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }

      if(Number(session.expiresAt || 0)<=Date.now()){
        sessionStorage.removeItem(STORAGE_KEY);
        return false;
      }

      state.session=session;
      state.lastCommandId=Number(saved?.lastCommandId || 0);
      startPolling();
      return true;
    }catch(e){
      try{ sessionStorage.removeItem(STORAGE_KEY); }catch(_){}
      return false;
    }
  }

  function getSlug(){
    return String(new URLSearchParams(location.search).get('loja') || '')
      .trim()
      .toLowerCase();
  }

  function controllerUrl(session){
    const base=String(session.controllerBaseUrl || location.origin).replace(/\/$/,'');
    const url=new URL(base+'/provador/controle.html');
    url.searchParams.set('session',session.id);
    url.searchParams.set('loja',session.slug);
    url.hash='token='+encodeURIComponent(session.controllerToken);
    return url.toString();
  }

  async function createSession(){
    const slug=getSlug();
    if(!slug) throw new Error('Loja nao identificada.');

    stop();

    const response=await fetch('/api/public/provador-remote/session',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({slug})
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok || !data?.session){
      throw new Error(data?.error || 'Nao foi possivel criar o controle remoto.');
    }

    state.session=data.session;
    state.lastCommandId=0;
    saveSession();
    startPolling();

    return {
      ...data.session,
      controllerUrl:controllerUrl(data.session)
    };
  }

  async function poll(){
    if(state.polling || !state.session) return;
    state.polling=true;

    try{
      const session=state.session;
      const response=await fetch(
        `/api/public/provador-remote/${encodeURIComponent(session.id)}/commands?after=${state.lastCommandId}`,
        {
          headers:{'x-provador-tv-token':session.tvToken},
          cache:'no-store'
        }
      );

      if(response.status===404 || response.status===403){
        stop();
        window.dispatchEvent(new CustomEvent('provador:mobile-remote-ended'));
        return;
      }

      const data=await response.json().catch(()=>({}));
      if(!response.ok) return;

      if(state.session && Number(data.expiresAt || 0)>0){
        state.session.expiresAt=Number(data.expiresAt);
        saveSession();
      }

      for(const item of Array.isArray(data.commands)?data.commands:[]){
        const id=Number(item?.id || 0);
        if(id>state.lastCommandId){
          state.lastCommandId=id;
          saveSession();
        }

        if(window.ProvadorControls?.execute){
          await window.ProvadorControls.execute(item.command,'remote');
        }

        window.dispatchEvent(new CustomEvent('provador:mobile-remote-command',{
          detail:{id,command:item.command}
        }));
      }
    }catch(e){
      // Mantem a sessao: uma falha momentanea de rede nao deve desligar o controle.
    }finally{
      state.polling=false;
    }
  }

  async function uploadRemotePhoto(dataUrl){
    if(!state.session || !dataUrl) return false;

    const session=state.session;
    try{
      const response=await fetch(
        `/api/public/provador-remote/${encodeURIComponent(session.id)}/photo`,
        {
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'x-provador-tv-token':session.tvToken
          },
          body:JSON.stringify({dataUrl})
        }
      );

      const data=await response.json().catch(()=>({}));
      if(!response.ok) return false;

      if(Number(data.expiresAt || 0)>0){
        state.session.expiresAt=Number(data.expiresAt);
        saveSession();
      }

      window.dispatchEvent(new CustomEvent('provador:remote-photo-uploaded',{
        detail:{createdAt:Number(data.createdAt || Date.now())}
      }));
      return true;
    }catch(e){
      return false;
    }
  }

  window.addEventListener('provador:remote-photo-captured',event=>{
    const dataUrl=String(event?.detail?.dataUrl || '');
    if(dataUrl) uploadRemotePhoto(dataUrl);
  });

  function startPolling(){
    clearInterval(state.timer);
    state.timer=setInterval(poll,1000);
    poll();
  }

  function stop(){
    clearInterval(state.timer);
    state.timer=null;
    state.polling=false;
    state.session=null;
    state.lastCommandId=0;
    try{ sessionStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  window.ProvadorMobileRemote={
    createSession,
    stop,
    getState:()=>({
      active:!!state.session,
      session:state.session?{...state.session}:null,
      lastCommandId:state.lastCommandId
    })
  };

  restoreSession();
})();
