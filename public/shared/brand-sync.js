(function(){
  const DEFAULTS = {name:'Sua Loja', sub:'Dashboard Integrado Multi-Loja', logo:'../assets/default-logo.svg', color:'#e33d8f'};
  function localCfg(){
    try{
      const st = window.parent?.LocalStoreManager?.getActive?.() || window.LocalStoreManager?.getActive?.();
      if (st) return { ...DEFAULTS, name:st.name, sub:st.sub, logo:st.logo, color:st.color };
    }catch(e){}
    return DEFAULTS;
  }
  async function fetchCfg(){
    try { const res = await fetch('/api/session/store-config', { credentials:'same-origin' }); if (res.ok) { const data = await res.json(); if (data.store) return { ...DEFAULTS, name:data.store.name, sub:data.store.sub, logo:data.store.logo, color:data.store.color }; } } catch(e) {}
    return localCfg();
  }
  async function apply(){
    const cfg = await fetchCfg();
    document.documentElement.style.setProperty('--brand-color', cfg.color || DEFAULTS.color);
    document.documentElement.style.setProperty('--pink-4', cfg.color || DEFAULTS.color);
    document.querySelectorAll('[data-brand-name], .brand-name').forEach(el => el.textContent = cfg.name || DEFAULTS.name);
    document.querySelectorAll('[data-brand-sub], .brand-sub').forEach(el => el.textContent = cfg.sub || DEFAULTS.sub);
    document.querySelectorAll('[data-brand-logo], .brand-logo-dynamic').forEach(el => { if(el.tagName==='IMG'){ el.src = cfg.logo || DEFAULTS.logo; el.alt = cfg.name || DEFAULTS.name; } else { el.style.backgroundImage = `url(${cfg.logo || DEFAULTS.logo})`; } });
    const metaTheme = document.querySelector('meta[name="theme-color"]'); if(metaTheme) metaTheme.setAttribute('content', cfg.color || DEFAULTS.color);
  }
  window.SharedBrand = { apply }; apply();
})();
