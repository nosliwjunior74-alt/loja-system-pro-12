(function(){
  function isTypingTarget(target){
    const tag=String(target?.tagName||'').toLowerCase();
    return tag==='input' || tag==='textarea' || tag==='select' || target?.isContentEditable;
  }

  function handleRemoteKey(event){
    if(isTypingTarget(event.target) || !window.ProvadorControls) return;

    let action=null;
    switch(event.key){
      case 'ArrowRight':
        action='nextLook';
        break;
      case 'ArrowLeft':
        action='previousLook';
        break;
      case 'ArrowUp':
        action='openLooks';
        break;
      case 'ArrowDown':
      case 'Escape':
        action='closeLooks';
        break;
      case 'Enter':
        action='toggleLooks';
        break;
      default:
        return;
    }

    event.preventDefault();
    const fn=window.ProvadorControls[action];
    if(typeof fn==='function') fn();
  }

  window.addEventListener('keydown',handleRemoteKey);
})();