
const LOJA_SEED = [{"id": "look1", "nome": "Blusa Floral Preta", "categoria": "Blusas", "preco": "89,90", "quantidade": 5, "imagem": "imagens/roupas/look1.jpg", "destaque": true}, {"id": "look2", "nome": "Camisa Branca Social", "categoria": "Camisas", "preco": "99,90", "quantidade": 4, "imagem": "imagens/roupas/look2.jpg", "destaque": true}, {"id": "look3", "nome": "Camisa Branca Sua Loja", "categoria": "Camisas", "preco": "109,90", "quantidade": 3, "imagem": "imagens/roupas/look3.jpg", "destaque": false}, {"id": "look4", "nome": "Blazer Social Preto", "categoria": "Blazers", "preco": "189,90", "quantidade": 2, "imagem": "imagens/roupas/look4.jpg", "destaque": false}, {"id": "look5", "nome": "Camiseta Preta Básica", "categoria": "Básicos", "preco": "59,90", "quantidade": 6, "imagem": "imagens/roupas/look5.jpg", "destaque": false}];
window.DB = {
  NAME:'loja_dashboard_db',
  VERSION:1,
  STORES:{ESTOQUE:'estoque',CLIENTES:'clientes',CONFIG:'config'},
  async open(){return new Promise((resolve,reject)=>{const req=indexedDB.open(this.NAME,this.VERSION);req.onupgradeneeded=e=>{const db=e.target.result;if(!db.objectStoreNames.contains(this.STORES.ESTOQUE))db.createObjectStore(this.STORES.ESTOQUE,{keyPath:'id'});if(!db.objectStoreNames.contains(this.STORES.CLIENTES))db.createObjectStore(this.STORES.CLIENTES,{keyPath:'id'});if(!db.objectStoreNames.contains(this.STORES.CONFIG))db.createObjectStore(this.STORES.CONFIG);};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);})},
  async getAll(store){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);})},
  async put(store,val){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(val);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);})},
  async delete(store,key){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);})},
  async clear(store){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);})},
  async getKV(key){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(this.STORES.CONFIG,'readonly');const req=tx.objectStore(this.STORES.CONFIG).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);})},
  async setKV(key,val){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(this.STORES.CONFIG,'readwrite');tx.objectStore(this.STORES.CONFIG).put(val,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);})}
};
window.AppStore={
  selectedKey:'loja_selected_item',
  async ensureSeed(){
    const inv=await DB.getAll(DB.STORES.ESTOQUE);
    if(inv.length===0){for(const item of LOJA_SEED) await DB.put(DB.STORES.ESTOQUE,item);}
    const cli=await DB.getAll(DB.STORES.CLIENTES);
    if(cli.length===0){await DB.put(DB.STORES.CLIENTES,{id:'cliente-demo',nome:'Cliente Exemplo',telefone:'31999990000',obs:'Prefere looks sociais.'});}
    const rest=await DB.getKV('rest_meta');
    if(!rest) await DB.setKV('rest_meta',{mode:'default',type:'image',name:'Logo padrão da loja'});
  },
  uid(name){return String(name||'item').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Date.now();},
  setSelected(item){localStorage.setItem(this.selectedKey,JSON.stringify(item));},
  getSelected(){try{return JSON.parse(localStorage.getItem(this.selectedKey)||'null')}catch(e){return null}}
};
