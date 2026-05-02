function ir(p){window.location.href=p}
const DPS={storesKey:'dps_stores_auto_v2',activeStoreKey:'dps_active_store_auto_v2',licenseKey:'dps_license_auto_v2',schedulerKey:'dps_scheduler_enabled_v2',
load(k,f){try{return JSON.parse(localStorage.getItem(k)) ?? f}catch{return f}},save(k,v){localStorage.setItem(k,JSON.stringify(v))},
stores(){return this.load(this.storesKey,[])},setStores(v){this.save(this.storesKey,v)},activeStore(){return localStorage.getItem(this.activeStoreKey)||''},setActiveStore(v){localStorage.setItem(this.activeStoreKey,v)},
productsKey(s){return `dps_products_auto_${s}`},campaignsKey(s){return `dps_campaigns_auto_${s}`},
products(s){return this.load(this.productsKey(s),[])},setProducts(s,v){this.save(this.productsKey(s),v)},campaigns(s){return this.load(this.campaignsKey(s),[])},setCampaigns(s,v){this.save(this.campaignsKey(s),v)},
licenseActive(){return localStorage.getItem(this.licenseKey)==='1'},activateLicense(code){if(code==='DPS-2026-ATIVO'){localStorage.setItem(this.licenseKey,'1');return true}return false},
ensureId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)},storeExists(name,ignoreId=''){return this.stores().some(s=>s.name.toLowerCase()===name.toLowerCase()&&s.id!==ignoreId)},findStoreById(id){return this.stores().find(s=>s.id===id)},
updateStore(id,patch){this.setStores(this.stores().map(s=>s.id===id?{...s,...patch}:s))},
deleteStore(id){const stores=this.stores();const store=stores.find(s=>s.id===id);if(!store)return;this.setStores(stores.filter(s=>s.id!==id));localStorage.removeItem(this.productsKey(store.name));localStorage.removeItem(this.campaignsKey(store.name));if(this.activeStore()===store.name)this.setActiveStore('')},
renameStoreData(oldName,newName){this.setProducts(newName,this.products(oldName));this.setCampaigns(newName,this.campaigns(oldName));localStorage.removeItem(this.productsKey(oldName));localStorage.removeItem(this.campaignsKey(oldName));if(this.activeStore()===oldName)this.setActiveStore(newName)},
getSelectedCampaignId(){return localStorage.getItem('dps_selected_campaign_auto')||''},setSelectedCampaignId(id){localStorage.setItem('dps_selected_campaign_auto',id)},
schedulerEnabled(){return localStorage.getItem(this.schedulerKey)==='1'},setSchedulerEnabled(v){localStorage.setItem(this.schedulerKey,v?'1':'0')}
};
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e;const b=document.getElementById('installBtn');if(b)b.classList.remove('hidden')});
async function installApp(){if(!deferredPrompt){alert('Use o botão Instalar do navegador se ele aparecer.');return}deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;const b=document.getElementById('installBtn');if(b)b.classList.add('hidden')}
if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}
async function fileToDataUrl(file){return await new Promise((res,rej)=>{if(!file)return res('');const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
function esc(s){return String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
function fmtDate(v){if(!v)return 'Não agendada';const d=new Date(v);return isNaN(d)?v:d.toLocaleString('pt-BR')}
function campaignText(c){return [c.title||c.name||'',c.caption||'',c.link||''].filter(Boolean).join('\n\n')}
function requestNotify(){if('Notification' in window && Notification.permission==='default'){Notification.requestPermission()}}
function launchCampaign(c){if(!c)return; const text=campaignText(c); try{navigator.clipboard.writeText(text)}catch(e){}
 if(c.networks?.whatsapp) window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
 if(c.networks?.instagram) window.open('https://www.instagram.com/','_blank');
 if(c.networks?.facebook){const link=c.link||'https://example.com'; window.open('https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(link),'_blank');}
 if(c.networks?.telegram){const link=c.link||'https://example.com'; window.open('https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text),'_blank');}
 if(c.networks?.tiktok){ window.open('https://www.tiktok.com/upload?lang=pt-BR','_blank'); }
}

function schedulerTick(){if(!DPS.schedulerEnabled()) return; const store=DPS.activeStore(); if(!store) return; let arr=DPS.campaigns(store); let changed=false; const now=Date.now(); arr=arr.map(c=>{if(!c.schedule||c.status==='pausada'||c.status==='disparada') return c; const when=new Date(c.schedule).getTime(); if(isNaN(when)) return c; if(when-now<=15*60*1000 && when>now && c.status==='agendada'){changed=true; return {...c,status:'pronta'};} if(when<=now && (c.status==='agendada'||c.status==='pronta')){launchCampaign(c); if('Notification' in window && Notification.permission==='granted'){new Notification('Campanha pronta para disparo',{body:(c.name||'Campanha')+' aberta nas redes.'})} changed=true; return {...c,status:'disparada',lastTriggeredAt:new Date().toISOString()};} return c;}); if(changed) DPS.setCampaigns(store,arr)}
setInterval(schedulerTick,30000);
