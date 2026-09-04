(function(){
  const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
  const state={
    supported:!!Recognition,
    enabled:false,
    listening:false,
    lastText:'',
    lastCommand:''
  };
  let recognition=null;
  let restartTimer=null;

  function normalize(text){
    return String(text||'')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/[^\w\s-]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function resolveCommand(text){
    const t=normalize(text);
    if(!t) return null;

    if(/\b(proximo look|proxima roupa|proximo|avancar|avanca)\b/.test(t)) return 'nextLook';
    if(/\b(look anterior|roupa anterior|anterior|voltar look)\b/.test(t)) return 'previousLook';
    if((/\b(abrir looks|mostrar looks|ver looks)\b/.test(t))) return 'openLooks';
    if(/\b(fechar looks|esconder looks)\b/.test(t)) return 'closeLooks';
    if(/\b(tirar foto|foto do look|fotografar)\b/.test(t)) return 'photo';
    if(/\b(enviar whatsapp|abrir whatsapp)\b/.test(t)) return 'whatsapp';
    if(/\b(abrir catalogo|ir para catalogo|trocar look)\b/.test(t)) return 'catalog';
    if(/\b(tela de descanso|ir para descanso|descanso)\b/.test(t)) return 'rest';
    if(/\b(ligar tracking|desligar tracking|tracking)\b/.test(t)) return 'tracking';

    return null;
  }

  async function executeText(text){
    state.lastText=String(text||'');
    const command=resolveCommand(text);
    state.lastCommand=command||'';

    if(!command || !window.ProvadorControls) return false;
    const fn=window.ProvadorControls[command];
    if(typeof fn!=='function') return false;

    await fn();
    window.dispatchEvent(new CustomEvent('provador:voice-command',{
      detail:{text:state.lastText,command}
    }));
    return true;
  }

  function setup(){
    if(!state.supported || recognition) return recognition;

    recognition=new Recognition();
    recognition.lang='pt-BR';
    recognition.continuous=true;
    recognition.interimResults=false;
    recognition.maxAlternatives=1;

    recognition.onstart=()=>{
      state.listening=true;
      window.dispatchEvent(new CustomEvent('provador:voice-status',{detail:{...state}}));
    };

    recognition.onresult=(event)=>{
      const result=event.results[event.results.length-1];
      const text=result?.[0]?.transcript || '';
      executeText(text);
    };

    recognition.onerror=(event)=>{
      const fatal=['not-allowed','service-not-allowed','audio-capture'];
      if(fatal.includes(event.error)) state.enabled=false;
      window.dispatchEvent(new CustomEvent('provador:voice-error',{detail:{error:event.error||'unknown'}}));
    };

    recognition.onend=()=>{
      state.listening=false;
      window.dispatchEvent(new CustomEvent('provador:voice-status',{detail:{...state}}));
      clearTimeout(restartTimer);
      if(state.enabled){
        restartTimer=setTimeout(()=>{
          try{ recognition.start(); }catch(e){}
        },350);
      }
    };

    return recognition;
  }

  function start(){
    if(!state.supported) return false;
    setup();
    state.enabled=true;
    try{
      recognition.start();
      return true;
    }catch(e){
      return state.listening;
    }
  }

  function stop(){
    state.enabled=false;
    clearTimeout(restartTimer);
    if(recognition){
      try{ recognition.stop(); }catch(e){}
    }
    return true;
  }

  function toggle(){
    return state.enabled ? stop() : start();
  }

  window.ProvadorVoice={
    supported:state.supported,
    start,
    stop,
    toggle,
    executeText,
    resolveCommand,
    getState:()=>({...state})
  };
})();