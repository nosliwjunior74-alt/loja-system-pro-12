
window.Estoque={
  async all(){await AppStore.ensureSeed();return await DB.getAll(DB.STORES.ESTOQUE);},
  async visible(){const items=await this.all();return items.filter(i=>Number(i.quantidade)>0);},
  async byId(id){const items=await this.all();return items.find(i=>i.id===id)||null;},
  async save(item){if(!item.id)item.id=AppStore.uid(item.nome);await DB.put(DB.STORES.ESTOQUE,item);return item;},
  async remove(id){await DB.delete(DB.STORES.ESTOQUE,id);},
  async adjust(id,delta){const item=await this.byId(id);if(!item)return;item.quantidade=Math.max(0,Number(item.quantidade||0)+delta);await this.save(item);},
  async restoreSeed(){await DB.clear(DB.STORES.ESTOQUE);for(const item of LOJA_SEED) await DB.put(DB.STORES.ESTOQUE,item);},
  async customers(){await AppStore.ensureSeed();return await DB.getAll(DB.STORES.CLIENTES);},
  async saveCustomer(c){if(!c.id)c.id=AppStore.uid(c.nome);await DB.put(DB.STORES.CLIENTES,c);},
  async removeCustomer(id){await DB.delete(DB.STORES.CLIENTES,id);}
};
