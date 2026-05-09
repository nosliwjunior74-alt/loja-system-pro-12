window.LocalStoreManager = {
  async list(){
    const r = await fetch('/api/stores');
    return await r.json();
  },

  async getById(id){
    const stores = await this.list();
    return stores.find(s => s.id === id);
  },

  async create(payload){
    const r = await fetch('/api/stores', {
      method:'POST',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify(payload)
    });

    return await r.json();
  },

  async update(id,payload){
    const r = await fetch('/api/stores/'+id,{
      method:'PUT',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify(payload)
    });

    return await r.json();
  },

  async remove(id){
    await fetch('/api/stores/'+id,{
      method:'DELETE'
    });
  }
};
