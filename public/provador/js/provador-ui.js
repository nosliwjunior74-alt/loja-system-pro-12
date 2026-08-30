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

  showControls();
})();
