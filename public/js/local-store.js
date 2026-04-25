(function(){
  const STORE_KEY='dashboardStoresLocal';
  const ACTIVE_KEY='dashboardActiveStoreIdLocal';
  const DEFAULTS={
    name:'Sua Loja',sub:'Dashboard Integrado Multi-Loja',color:'#e33d8f',logo:'assets/default-logo.svg',
    login:'admin',password:'123456',slug:'sua-loja',status:'ativo',plan:'premium',expiresAt:'',
    customDomain:'',email:'',phone:'',licenseStatus:'ativa',licenseKey:''
  };
  function uid(){ return 'store-'+Date.now()+'-'+Math.random().toString(36).slice(2,7); }
  function slugify(value){
    return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60) || 'loja';
  }
  function readRaw(){ try{ const arr=JSON.parse(localStorage.getItem(STORE_KEY)||'[]'); return Array.isArray(arr)?arr:[]; }catch(e){ return []; } }
  function writeRaw(arr){ localStorage.setItem(STORE_KEY, JSON.stringify(arr)); }
  function uniqueSlug(slug, ignoreId=''){
    const arr=readRaw(); const base=slugify(slug); let s=base, i=2;
    while(arr.some(x=>x.slug===s && x.id!==ignoreId)){ s=base+'-'+i++; }
    return s;
  }
  function computeLicenseStatus(store){
    if(store.status==='inativo') return 'bloqueada';
    if(store.status==='degustacao') return 'em degustação';
    if(store.expiresAt && store.expiresAt < new Date().toISOString().slice(0,10)) return 'bloqueada';
    return 'ativa';
  }
  function localBase(){ const href=location.href.replace(/[#?].*$/,''); return href.replace(/\/[^/]*$/,'/'); }
  function normalize(store){
    const s={...DEFAULTS,...store};
    s.slug = uniqueSlug(s.slug||s.name||'loja', s.id);
    s.licenseStatus = computeLicenseStatus(s);
    s.publicLink = s.customDomain ? `https://${s.customDomain}` : `${localBase()}login-loja.html?loja=${encodeURIComponent(s.slug)}`;
    return s;
  }
  function ensureSeed(){
    let arr=readRaw();
    if(!arr.length){
      const st={...DEFAULTS,id:uid(),slug:'sua-loja',licenseKey:'LOCAL-'+Date.now(),createdAt:new Date().toISOString()};
      arr=[st]; writeRaw(arr); localStorage.setItem(ACTIVE_KEY, st.id);
    }
    if(!localStorage.getItem(ACTIVE_KEY) && arr[0]) localStorage.setItem(ACTIVE_KEY, arr[0].id);
  }
  function list(){ ensureSeed(); return readRaw().map(normalize); }
  function getActiveId(){ ensureSeed(); return localStorage.getItem(ACTIVE_KEY)||''; }
  function getById(id){ return list().find(s=>s.id===id)||null; }
  function getActive(){ const id=getActiveId(); return getById(id) || list()[0] || null; }
  function setActive(id){
    localStorage.setItem(ACTIVE_KEY,id);
    const st=getById(id);
    if(st) localStorage.setItem('lojaAtivaConfig', JSON.stringify({name:st.name,sub:st.sub,logo:st.logo,color:st.color,status:st.status,licenseStatus:st.licenseStatus}));
  }
  function create(payload){
    const arr=readRaw(); const id=uid();
    const st={...DEFAULTS,...payload,id,slug:uniqueSlug(payload.slug||payload.name||'loja'),
      licenseKey:'LOCAL-'+Math.random().toString(36).slice(2,10).toUpperCase(),createdAt:new Date().toISOString()};
    arr.unshift(st); writeRaw(arr); setActive(id); return normalize(st);
  }
  function update(id,payload){
    const arr=readRaw(); const idx=arr.findIndex(s=>s.id===id); if(idx<0) return null;
    const updated={...arr[idx],...payload}; updated.slug=uniqueSlug(updated.slug||updated.name||'loja',id);
    arr[idx]=updated; writeRaw(arr);
    if(getActiveId()===id) setActive(id);
    return normalize(updated);
  }
  function remove(id){
    let arr=readRaw().filter(s=>s.id!==id);
    if(!arr.length) arr=[{...DEFAULTS,id:uid(),slug:'sua-loja',licenseKey:'LOCAL-'+Date.now(),createdAt:new Date().toISOString()}];
    writeRaw(arr);
    if(getActiveId()===id) setActive(arr[0].id);
  }
  function updateStatus(id,status){ return update(id,{status}); }
  window.LocalStoreManager={ensureSeed,list,getActiveId,getActive,setActive,create,update,remove,getById,updateStatus};
})();
