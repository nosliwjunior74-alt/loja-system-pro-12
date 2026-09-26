(function(){
  const body = document.body;
  if (!body || !body.classList.contains('provador-pro')) return;

  let idleTimer = null;
  const IDLE_MS = 5000;

  function showControls(){
    body.classList.remove('controls-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(()=>{
      body.classList.add('controls-idle');
    }, IDLE_MS);
  }

  ['pointerdown','pointermove','touchstart','keydown'].forEach(eventName=>{
    window.addEventListener(eventName, showControls, { passive:true });
  });

  document.addEventListener('visibilitychange', ()=>{
    if (!document.hidden) showControls();
  });

  const autoFramingBtn=document.getElementById('autoFramingBtn');

  function updateAutoFramingBtn(){
    if(!autoFramingBtn) return;
    const on=window.CameraModule?.getAutoFraming?.() !== false;
    autoFramingBtn.textContent=on?'ENQUADRAMENTO AUTO ON':'ENQUADRAMENTO AUTO OFF';
    autoFramingBtn.setAttribute('aria-pressed',String(on));
    autoFramingBtn.classList.toggle('is-on',on);
  }

  if(autoFramingBtn){
    autoFramingBtn.addEventListener('click',()=>{
      window.CameraModule?.toggleAutoFraming?.();
      updateAutoFramingBtn();
      showControls();
    });
    window.addEventListener('provador:camera-framing-status',updateAutoFramingBtn);
    updateAutoFramingBtn();
  }

  const cameraFocusBtn=document.getElementById('cameraFocusBtn');

  function updateCameraFocusBtn(event){
    if(!cameraFocusBtn) return;
    const state=event?.detail || window.CameraModule?.getCameraFocusState?.() || {};

    if(!state.ready){
      cameraFocusBtn.disabled=true;
      cameraFocusBtn.textContent='FOCO CÂMERA: DETECTANDO...';
      cameraFocusBtn.title='Aguardando a câmera iniciar.';
      return;
    }

    if(!state.supported){
      cameraFocusBtn.disabled=true;
      cameraFocusBtn.textContent='FOCO CÂMERA N/D';
      cameraFocusBtn.setAttribute('aria-pressed','false');
      cameraFocusBtn.classList.remove('is-on');
      cameraFocusBtn.title='Esta câmera ou navegador não oferece controle manual de foco.';
      return;
    }

    const auto=state.auto !== false;
    cameraFocusBtn.disabled=false;
    cameraFocusBtn.textContent=auto?'FOCO CÂMERA AUTO':'FOCO CÂMERA FIXO';
    cameraFocusBtn.setAttribute('aria-pressed',String(auto));
    cameraFocusBtn.classList.toggle('is-on',auto);
    cameraFocusBtn.title=auto
      ? 'Clique para travar o foco físico na distância atual.'
      : 'Clique para voltar ao autofocus contínuo.';
  }

  if(cameraFocusBtn){
    cameraFocusBtn.addEventListener('click',async()=>{
      if(cameraFocusBtn.disabled) return;
      cameraFocusBtn.disabled=true;
      cameraFocusBtn.textContent='AJUSTANDO FOCO...';
      try{
        const state=await window.CameraModule?.toggleCameraFocusAuto?.();
        updateCameraFocusBtn({detail:state || {}});
      }catch(error){
        console.error('Falha ao alternar foco físico da câmera:',error);
        updateCameraFocusBtn();
      }
      showControls();
    });
    window.addEventListener('provador:camera-focus-status',updateCameraFocusBtn);
    updateCameraFocusBtn();
  }

  const voiceBtn=document.getElementById('voiceBtn');
  if(voiceBtn){
    if(!window.ProvadorVoice || !window.ProvadorVoice.supported){
      voiceBtn.style.display='none';
    }else{
      const updateVoiceBtn=()=>{
        const voiceState=window.ProvadorVoice.getState();
        const on=!!voiceState.enabled;
        voiceBtn.textContent=on?'VOZ ON':'VOZ OFF';
        voiceBtn.setAttribute('aria-pressed',String(on));
        voiceBtn.classList.toggle('is-on',on);
      };

      voiceBtn.addEventListener('click',()=>{
        window.ProvadorVoice.toggle();
        setTimeout(updateVoiceBtn,100);
        showControls();
      });

      window.addEventListener('provador:voice-status',updateVoiceBtn);
      window.addEventListener('provador:voice-error',updateVoiceBtn);
      updateVoiceBtn();
    }
  }


  const menuBtn=document.getElementById('provadorMenuBtn');
  const menuPanel=document.getElementById('provadorMenuPanel');

  function setMenuOpen(open){
    if(!menuBtn || !menuPanel) return;
    menuPanel.hidden=!open;
    menuBtn.setAttribute('aria-expanded',String(open));
    menuBtn.textContent=open?'FECHAR':'MENU';
    showControls();
  }

  if(menuBtn && menuPanel){
    menuBtn.addEventListener('click',(event)=>{
      event.stopPropagation();
      setMenuOpen(menuPanel.hidden);
    });

    menuPanel.addEventListener('click',(event)=>{
      event.stopPropagation();
    });

    document.addEventListener('click',()=>{
      if(!menuPanel.hidden) setMenuOpen(false);
    });

    window.addEventListener('keydown',(event)=>{
      if(event.key==='Escape' && !menuPanel.hidden){
        setMenuOpen(false);
      }
    });
  }


  const mobileRemoteBtn=document.getElementById('mobileRemoteBtn');
  const mobileRemotePairing=document.getElementById('mobileRemotePairing');
  const mobileRemoteLink=document.getElementById('mobileRemoteLink');
  const mobileRemoteCopyBtn=document.getElementById('mobileRemoteCopyBtn');
  const mobileRemoteQr=document.getElementById('mobileRemoteQr');

  if(mobileRemoteCopyBtn && mobileRemoteLink){
    mobileRemoteCopyBtn.addEventListener('click',async(event)=>{
      event.stopPropagation();

      const value=String(mobileRemoteLink.value || '').trim();
      if(!value) return;

      let copied=false;

      try{
        if(navigator.clipboard?.writeText && window.isSecureContext){
          await navigator.clipboard.writeText(value);
          copied=true;
        }
      }catch(error){}

      if(!copied){
        mobileRemoteLink.focus();
        mobileRemoteLink.select();
        try{
          copied=document.execCommand('copy');
        }catch(error){}
      }

      mobileRemoteCopyBtn.textContent=copied?'LINK COPIADO':'SELECIONE E COPIE';
      setTimeout(()=>{
        mobileRemoteCopyBtn.textContent='COPIAR LINK';
      },1800);
    });
  }

  if(mobileRemoteBtn){
    mobileRemoteBtn.addEventListener('click',async()=>{
      if(!window.ProvadorMobileRemote?.createSession) return;

      const originalText=mobileRemoteBtn.textContent;
      mobileRemoteBtn.disabled=true;
      mobileRemoteBtn.textContent='GERANDO CONTROLE...';

      try{
        const session=await window.ProvadorMobileRemote.createSession();

        if(!session?.controllerUrl){
          throw new Error('Link do controle nao gerado.');
        }

        if(mobileRemoteLink){
          mobileRemoteLink.value=session.controllerUrl;
        }

        if(mobileRemoteQr){
          mobileRemoteQr.innerHTML='';
          if(session.controllerQrDataUrl){
            const qrImage=document.createElement('img');
            qrImage.src=session.controllerQrDataUrl;
            qrImage.alt='QR Code do controle celular';
            qrImage.className='provador-mobile-pairing-qr-image';
            mobileRemoteQr.appendChild(qrImage);
            mobileRemoteQr.hidden=false;
          }else{
            mobileRemoteQr.hidden=true;
          }
        }

        if(mobileRemotePairing){
          mobileRemotePairing.hidden=false;
        }

        window.dispatchEvent(new CustomEvent('provador:mobile-remote-session',{
          detail:session
        }));

        mobileRemoteBtn.textContent='CONTROLE CELULAR ATIVO';
      }catch(error){
        console.error('Falha ao criar controle remoto:',error);

        if(mobileRemotePairing){
          mobileRemotePairing.hidden=true;
        }

        if(mobileRemoteLink){
          mobileRemoteLink.value='';
        }

        if(mobileRemoteQr){
          mobileRemoteQr.innerHTML='';
          mobileRemoteQr.hidden=true;
        }

        mobileRemoteBtn.textContent=originalText;
      }finally{
        mobileRemoteBtn.disabled=false;
        showControls();
      }
    });
  }

  showControls();
})();
