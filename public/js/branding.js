(async function(){
  const defaults = { name: 'Sua Loja', sub: 'Dashboard Integrado Multi-Loja', logo: 'assets/default-logo.svg', color: '#e33d8f' };
  let cfg = { ...defaults };
  try {
    const res = await fetch('/api/admin/session');
    if (res.ok) {
      const data = await res.json();
      if (data.activeStore) cfg = { ...cfg, name:data.activeStore.name, sub:data.activeStore.sub, logo:data.activeStore.logo, color:data.activeStore.color };
    } else if (window.LocalStoreManager) {
      const st = LocalStoreManager.getActive(); if (st) cfg = { ...cfg, name:st.name, sub:st.sub, logo:st.logo, color:st.color };
    }
  } catch (e) {
    if (window.LocalStoreManager) { const st = LocalStoreManager.getActive(); if (st) cfg = { ...cfg, name:st.name, sub:st.sub, logo:st.logo, color:st.color }; }
  }
  const brandName = document.getElementById('brandName');
  const brandSub = document.getElementById('brandSub');
  const topbarSub = document.getElementById('topbarSub');
  const brandLogo = document.getElementById('brandLogo');
  const rootEl = document.documentElement;
  if (brandName) brandName.textContent = cfg.name;
  if (brandSub) brandSub.textContent = cfg.sub;
  if (topbarSub) topbarSub.textContent = cfg.sub;
  if (brandLogo) brandLogo.src = cfg.logo;
  if (rootEl && cfg.color) rootEl.style.setProperty('--pink-4', cfg.color);
})();
