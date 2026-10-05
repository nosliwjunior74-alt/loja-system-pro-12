
window.Estoque={
  safeParse(valor, padrao = []) {
  try {
if (!valor || valor === "undefined") return padrao;
return typeof valor === "string" ? JSON.parse(valor) : valor;   
  } catch(e) {
    console.error('Erro JSON:', e);
    return padrao;
  }
},
async all(){
  return await DB.getAll(DB.STORES.ESTOQUE);
},
 async visible(){
    const items = await this.all();
    return items.filter(i => Number(i.quantidade) > 0);
},
async byId(id){
    const items = await this.all();
    return items.find(i => i.id == id) || null;
},

 // PROVADOR PRO STOCK SYNC V1B
  pendingKey:'stock_outbox_v1',
  syncStatusKey:'stock_sync_status_v1',

  async pendingMovements(){
    const list=await DB.getKV(this.pendingKey);
    return Array.isArray(list) ? list : [];
  },

  async setPendingMovements(list){
    await DB.setKV(this.pendingKey,Array.isArray(list) ? list : []);
  },

  async getSyncStatus(){
    const status=await DB.getKV(this.syncStatusKey);
    return status && typeof status==='object' ? status : {pending:0,state:'local'};
  },

  async setSyncStatus(status){
    const value={...(status && typeof status==='object' ? status : {}),updatedAt:new Date().toISOString()};
    await DB.setKV(this.syncStatusKey,value);
    try{ window.dispatchEvent(new CustomEvent('provador-stock-sync',{detail:value})); }catch(e){}
    return value;
  },

  productUpsertOperation(item,isNew=false){
    const snapshot={...(item&&typeof item==='object'?item:{})};
    return {
      id:'upsert_'+String(snapshot.id||'item')+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      itemId:String(snapshot.id||''),
      tipo:'upsert',
      isNew:Boolean(isNew),
      item:snapshot,
      data:new Date().toISOString()
    };
  },

  async queueProductUpsert(item,isNew=false){
    if(!item?.id) return null;
    const op=this.productUpsertOperation(item,isNew);
    await this.queueMovement(op);
    return op;
  },

  async queueMovement(operation){
    if(!operation || !operation.id) return;
    const pending=await this.pendingMovements();
    const next=[...pending.filter(op=>String(op?.id||'')!==String(operation.id)),operation];
    await this.setPendingMovements(next);
    await this.setSyncStatus({state:navigator.onLine===false ? 'offline' : 'pending',pending:next.length});
  },

  async replaceLocalFromServer(items){
    if(!Array.isArray(items)) return;
    await DB.clear(DB.STORES.ESTOQUE);
    for(const item of items) await DB.put(DB.STORES.ESTOQUE,item);
  },

  async syncPendingMovements(){
    const pending=await this.pendingMovements();
    if(!pending.length){
      await this.setSyncStatus({state:navigator.onLine===false?'offline':'synced',pending:0});
      return {ok:true,pending:0,acknowledged:[],conflicts:[]};
    }
    if(navigator.onLine===false){
      await this.setSyncStatus({state:'offline',pending:pending.length});
      return {ok:false,offline:true,pending:pending.length};
    }
    try{
      const response=await fetch('/api/public/stock-movements/sync',{
        method:'POST',
        credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operations:pending})
      });
      if(!response.ok) throw new Error('HTTP '+response.status);
      const data=await response.json();
      const acknowledged=new Set(Array.isArray(data?.acknowledged)?data.acknowledged.map(String):[]);
      const remaining=pending.filter(op=>!acknowledged.has(String(op?.id||'')));
      await this.setPendingMovements(remaining);
      if(!remaining.length && Array.isArray(data?.estoque)) await this.replaceLocalFromServer(data.estoque);
      const conflicts=Array.isArray(data?.conflicts)?data.conflicts:[];
      await this.setSyncStatus({
        state:remaining.length?'conflict':'synced',
        pending:remaining.length,
        conflicts,
        lastSyncAt:new Date().toISOString()
      });
      return {ok:true,pending:remaining.length,acknowledged:[...acknowledged],conflicts,estoque:data?.estoque};
    }catch(error){
      console.error('Falha ao sincronizar movimentacoes pendentes:',error);
      await this.setSyncStatus({state:'pending',pending:pending.length,lastError:String(error?.message||error)});
      return {ok:false,pending:pending.length,error:String(error?.message||error)};
    }
  },

  async saveMovement(item,movement){
    if(!item || !item.id || !movement || !movement.id) return item;
    await DB.put(DB.STORES.ESTOQUE,item);
    const operation={
      id:String(movement.id),
      itemId:String(item.id),
      tipo:String(movement.tipo||''),
      quantidade:Number(movement.quantidade||0),
      baseQuantity:Number(movement.anterior||0),
      targetQuantity:Number(movement.posterior||0),
      motivo:String(movement.motivo||''),
      data:String(movement.data||new Date().toISOString())
    };
    await this.queueMovement(operation);
    await this.syncPendingMovements();
    return item;
  },

 async save(item){

  const existing = item?.id ? await this.byId(item.id) : null;
  await DB.put(DB.STORES.ESTOQUE,item);

  // Offline: cadastro/preco precisa entrar no outbox, nao apenas ficar no IndexedDB.
  if(navigator.onLine===false){
    await this.queueProductUpsert(item,!existing);
    console.log('Produto salvo OFFLINE e enfileirado para sincronizacao:',item?.id);
    return item;
  }

  const pendingBeforeSave = await this.pendingMovements();
  if(pendingBeforeSave.length){
    await this.syncPendingMovements();
    const remainingAfterSync = await this.pendingMovements();
    if(remainingAfterSync.length){
      await this.queueProductUpsert(item,!existing);
      console.warn('Produto salvo localmente e enfileirado; sincronizacao completa adiada porque ha operacoes pendentes.');
      return item;
    }
  }

  try{
    const lojaAtual =
      new URLSearchParams(location.search).get('loja') ||
      localStorage.getItem('loja_slug') ||
      '';
    if (!lojaAtual) {
      console.error('Nenhuma loja detectada.');
      await this.queueProductUpsert(item,!existing);
      return item;
    }

    const r = await fetch(`/api/public/store/${encodeURIComponent(lojaAtual)}`,{cache:'no-store'});
    if(!r.ok) throw new Error('HTTP '+r.status);
    const data = await r.json();
    const store = data.store || {};
    let estoqueAtual = store.estoque || [];
    while(typeof estoqueAtual === 'string'){
      try{ estoqueAtual=JSON.parse(estoqueAtual); }catch(e){ estoqueAtual=[]; break; }
    }
    if(!Array.isArray(estoqueAtual)) estoqueAtual=[];
    const novoEstoque=[...estoqueAtual.filter(i=>String(i?.id)!==String(item.id)),item];
    const saveResponse=await fetch('/api/public/store-branding',{
      method:'PUT',credentials:'include',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({estoque:novoEstoque})
    });
    if(!saveResponse.ok) throw new Error('HTTP '+saveResponse.status);
  }catch(e){
    console.error('Erro sincronizando cadastro/preco online; operacao enfileirada.',e);
    await this.queueProductUpsert(item,!existing);
  }

  return item;
},
  async remove(id){
    await DB.delete(DB.STORES.ESTOQUE,id);
    const operation={
      id:'del_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),
      itemId:String(id||''),tipo:'delete',quantidade:0,baseQuantity:0,targetQuantity:0,
      motivo:'Exclusao de produto',data:new Date().toISOString()
    };
    await this.queueMovement(operation);
    await this.syncPendingMovements();
  },
  async adjust(id,delta){const item=await this.byId(id);if(!item)return;item.quantidade=Math.max(0,Number(item.quantidade||0)+delta);await this.save(item);},
  async restoreSeed(){await DB.clear(DB.STORES.ESTOQUE);for(const item of LOJA_SEED) await DB.put(DB.STORES.ESTOQUE,item);},
  // PROVADOR PRO CUSTOMERS ONLINE + OFFLINE V1B
  customerPendingKey:'customer_outbox_v1',
  customerSyncStatusKey:'customer_sync_status_v1',
  customerBootstrapKey:'customer_sync_bootstrap_v1',

  async customerPendingOperations(){
    const list=await DB.getKV(this.customerPendingKey);
    return Array.isArray(list) ? list : [];
  },

  async setCustomerPendingOperations(list){
    await DB.setKV(this.customerPendingKey,Array.isArray(list)?list:[]);
  },

  async getCustomerSyncStatus(){
    const status=await DB.getKV(this.customerSyncStatusKey);
    return status && typeof status==='object' ? status : {pending:0,state:'local'};
  },

  async setCustomerSyncStatus(status){
    const value={...(status&&typeof status==='object'?status:{}),updatedAt:new Date().toISOString()};
    await DB.setKV(this.customerSyncStatusKey,value);
    try{ window.dispatchEvent(new CustomEvent('provador-customer-sync',{detail:value})); }catch(e){}
    return value;
  },

  async queueCustomerOperation(operation){
    if(!operation?.id || !operation?.customerId) return;
    const pending=await this.customerPendingOperations();
    const next=[...pending.filter(op=>String(op?.id||'')!==String(operation.id)),operation];
    await this.setCustomerPendingOperations(next);
    await this.setCustomerSyncStatus({state:navigator.onLine===false?'offline':'pending',pending:next.length});
  },

  async replaceLocalCustomersFromServer(customers){
    if(!Array.isArray(customers)) return;
    await DB.clear(DB.STORES.CLIENTES);
    for(const customer of customers) await DB.put(DB.STORES.CLIENTES,customer);
  },

  async syncPendingCustomers(){
    const pending=await this.customerPendingOperations();
    if(!pending.length){
      await this.setCustomerSyncStatus({state:navigator.onLine===false?'offline':'synced',pending:0});
      return {ok:true,pending:0,acknowledged:[],conflicts:[]};
    }
    if(navigator.onLine===false){
      await this.setCustomerSyncStatus({state:'offline',pending:pending.length});
      return {ok:false,offline:true,pending:pending.length};
    }
    try{
      const response=await fetch('/api/public/customer-operations/sync',{
        method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({operations:pending})
      });
      if(!response.ok) throw new Error('HTTP '+response.status);
      const data=await response.json();
      const acknowledged=new Set(Array.isArray(data?.acknowledged)?data.acknowledged.map(String):[]);
      const conflictIds=new Set(Array.isArray(data?.conflicts)?data.conflicts.map(c=>String(c?.id||'')):[]);
      const remaining=pending.filter(op=>!acknowledged.has(String(op?.id||'')) && conflictIds.has(String(op?.id||'')));
      await this.setCustomerPendingOperations(remaining);
      if(!remaining.length && Array.isArray(data?.customers)) await this.replaceLocalCustomersFromServer(data.customers);
      const conflicts=Array.isArray(data?.conflicts)?data.conflicts:[];
      await this.setCustomerSyncStatus({state:remaining.length?'conflict':'synced',pending:remaining.length,conflicts,lastSyncAt:new Date().toISOString()});
      return {ok:true,pending:remaining.length,acknowledged:[...acknowledged],conflicts,customers:data?.customers};
    }catch(error){
      console.error('Falha ao sincronizar clientes pendentes:',error);
      await this.setCustomerSyncStatus({state:'pending',pending:pending.length,lastError:String(error?.message||error)});
      return {ok:false,pending:pending.length,error:String(error?.message||error)};
    }
  },

  async bootstrapCustomerSync(){
    const bootstrapped=await DB.getKV(this.customerBootstrapKey);
    if(bootstrapped) return this.syncPendingCustomers();
    const local=await DB.getAll(DB.STORES.CLIENTES);
    for(const customer of local){
      if(!customer?.id) continue;
      await this.queueCustomerOperation({
        id:'bootstrap_'+String(customer.id),customerId:String(customer.id),type:'upsert',customer,
        data:new Date().toISOString()
      });
    }
    await DB.setKV(this.customerBootstrapKey,{done:true,at:new Date().toISOString()});
    return this.syncPendingCustomers();
  },

  async customers(){await AppStore.ensureSeed();return await DB.getAll(DB.STORES.CLIENTES);},
  async saveCustomer(c){
    if(!c.id)c.id=AppStore.uid(c.nome);
    await DB.put(DB.STORES.CLIENTES,c);
    const operation={id:'customer_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),customerId:String(c.id),type:'upsert',customer:{...c},data:new Date().toISOString()};
    await this.queueCustomerOperation(operation);
    await this.syncPendingCustomers();
    return c;
  },
  async removeCustomer(id){
    await DB.delete(DB.STORES.CLIENTES,id);
    const operation={id:'customer_del_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),customerId:String(id||''),type:'delete',data:new Date().toISOString()};
    await this.queueCustomerOperation(operation);
    await this.syncPendingCustomers();
  }
};
window.addEventListener('online',()=>{
  window.Estoque?.syncPendingMovements?.().catch(error=>console.error('Retry automatico do estoque falhou:',error));
  window.Estoque?.syncPendingCustomers?.().catch(error=>console.error('Retry automatico de clientes falhou:',error));
});
window.addEventListener('offline',()=>{
  window.Estoque?.pendingMovements?.().then(list=>{
    window.Estoque?.setSyncStatus?.({state:'offline',pending:Array.isArray(list)?list.length:0});
  }).catch(()=>{});
  window.Estoque?.customerPendingOperations?.().then(list=>{
    window.Estoque?.setCustomerSyncStatus?.({state:'offline',pending:Array.isArray(list)?list.length:0});
  }).catch(()=>{});
});
