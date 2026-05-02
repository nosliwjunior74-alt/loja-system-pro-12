(function(){
  const DEFAULTS = {
    name: 'Sua Loja',
    sub: 'Configure a identidade da sua loja',
    logo: '../assets/default-logo.svg',
    color: '#e33d8f'
  };
  function safeJson(v){ try { return JSON.parse(v || '{}'); } catch(e){ return {}; } }
  async function getCfg(){
    try {
      const res = await fetch('/api/session/store-config', { credentials:'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.store) {
          return {
            name: data.store.name || DEFAULTS.name,
            sub: data.store.sub || DEFAULTS.sub,
            logo: data.store.logo || DEFAULTS.logo,
            color: data.store.color || DEFAULTS.color
          };
        }
      }
    } catch(e) {}
    const localCfg = safeJson(localStorage.getItem('lojaAtivaConfig'));
    const branding = safeJson(localStorage.getItem('dashboardBranding'));
    const cfg = Object.assign({}, DEFAULTS, branding, localCfg);
    return {
      name: cfg.name || DEFAULTS.name,
      sub: cfg.sub || DEFAULTS.sub,
      logo: cfg.logo || DEFAULTS.logo,
      color: cfg.color || DEFAULTS.color
    };
  }
  function applyText(el, text){ if (el) el.textContent = text; }
  function applyImage(el, src, alt){ if (!el) return; el.src = src; el.alt = alt; el.style.display = ''; }
  async function apply(){
    const cfg = await getCfg();
    document.documentElement.style.setProperty('--brand-color', cfg.color);
    document.documentElement.style.setProperty('--pink-4', cfg.color);
    document.documentElement.style.setProperty('--cor-principal', cfg.color);
    document.querySelectorAll('[data-brand-name], .brand-name').forEach(el => applyText(el, cfg.name));
    document.querySelectorAll('[data-brand-sub], .brand-sub').forEach(el => applyText(el, cfg.sub));
    ['#brandName', '#nomeLoja', '.title', '.name', '#restLabel'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        const t = (el.textContent || '').trim();
        if (!t || /boutique mp|sua loja|logo boutique|logo padrão/i.test(t)) applyText(el, cfg.name);
      });
    });
    document.querySelectorAll('img.logo, img.brand-logo-dynamic, [data-brand-logo]').forEach(el => applyImage(el, cfg.logo, cfg.name));
    document.querySelectorAll('img').forEach(img => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      if (/logo\.png|boutique mp|bmp_/i.test(src) || /boutique mp/i.test(alt)) applyImage(img, cfg.logo, cfg.name);
    });
    document.querySelectorAll('h1,h2,h3,p,span,div').forEach(el => {
      const t = (el.textContent || '').trim();
      if (/^boutique mp$/i.test(t) || /^logo boutique mp$/i.test(t)) el.textContent = cfg.name;
      if (/mulheres de propósito/i.test(t)) el.textContent = cfg.sub;
    });
    if (/boutique mp/i.test(document.title)) document.title = document.title.replace(/boutique mp/ig, cfg.name);
  }
  apply();
})();