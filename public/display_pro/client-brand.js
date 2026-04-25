(function(){
  const DEFAULTS = {name:'Sua Loja', sub:'Display da loja', logo:'../assets/default-logo.svg', color:'#ff2f7d'};
  function localCfg(){
    try{
      const st = window.parent?.LocalStoreManager?.getActive?.() || window.LocalStoreManager?.getActive?.();
      if (st) return { ...DEFAULTS, name:st.name, sub:st.sub || DEFAULTS.sub, logo:st.logo || DEFAULTS.logo, color:st.color || DEFAULTS.color };
    }catch(e){}
    try{
      const cfg = JSON.parse(localStorage.getItem('lojaAtivaConfig')||'{}');
      return { ...DEFAULTS, name:cfg.name||DEFAULTS.name, sub:cfg.sub||DEFAULTS.sub, logo:cfg.logo||DEFAULTS.logo, color:cfg.color||DEFAULTS.color };
    }catch(e){}
    return DEFAULTS;
  }
  async function getCfg(){
    try {
      const res = await fetch('/api/session/store-config', { credentials:'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.store) return { ...DEFAULTS, name:data.store.name, sub:data.store.sub||DEFAULTS.sub, logo:data.store.logo||DEFAULTS.logo, color:data.store.color||DEFAULTS.color };
      }
    } catch(e) {}
    return localCfg();
  }
  function ensureDisplayStore(cfg){
    try{
      if(!window.DPS) return;
      const stores = DPS.stores ? DPS.stores() : [];
      if(!stores.some(s => s && s.name === cfg.name)){
        stores.unshift({ id: 'client-'+cfg.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'), name: cfg.name, color: cfg.color, subtitle: cfg.sub, logo: cfg.logo });
        DPS.setStores && DPS.setStores(stores);
      }
      DPS.setActiveStore && DPS.setActiveStore(cfg.name);
    }catch(e){}
  }
  async function apply(){
    const cfg = await getCfg();
    ensureDisplayStore(cfg);
    document.documentElement.style.setProperty('--brand-color', cfg.color || DEFAULTS.color);
    document.querySelectorAll('[data-brand-name], .brand-name').forEach(el => el.textContent = cfg.name);
    document.querySelectorAll('[data-brand-sub], .brand-sub').forEach(el => el.textContent = cfg.sub);
    document.querySelectorAll('img.brand-logo-dynamic, [data-brand-logo], #displayBrandLogo').forEach(el => {
      if (el.tagName === 'IMG') { el.src = cfg.logo; el.alt = cfg.name; }
    });
    document.querySelectorAll('.topo h1').forEach(el => {
      const t = (el.textContent||'').trim();
      if (/display|painel do cliente|painel da loja|catálogo|provador|biblioteca|disparo|calendário|manual/i.test(t)) el.textContent = cfg.name;
    });
    document.querySelectorAll('.topo p').forEach(el => {
      const t = (el.textContent||'').trim();
      if (!t || /versão instalável|criar, entrar|controle de produtos|carrega campanhas|painel|agenda|salvas/i.test(t)) el.textContent = cfg.sub || DEFAULTS.sub;
    });
    document.querySelectorAll('.rodape').forEach(el => el.textContent = cfg.name);
    const info = document.getElementById('storeInfo');
    if(info) info.textContent = 'Loja ativa: ' + cfg.name;
  }
  apply();
})();