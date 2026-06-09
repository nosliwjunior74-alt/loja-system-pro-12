
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
  async all(){await AppStore.ensureSeed();return await DB.getAll(DB.STORES.ESTOQUE);},
  async visible(){const items=await this.all();return items.filter(i=>Number(i.quantidade)>0);},
  async byId(id){const items=await this.all();return items.find(i=>i.id===id)||null;},
 async save(item){

  await DB.put(DB.STORES.ESTOQUE,item);

  try{

    const lojaAtual =
      new URLSearchParams(location.search).get('loja') ||
      localStorage.getItem('loja_slug') ||
     ''; 

    const r = await fetch(`/api/public/store/${encodeURIComponent(lojaAtual)}`);

    const texto = await r.text();

console.log("RETORNO API:", texto);

let data = {};

try {
    data = JSON.parse(texto);
} catch(e) {
    console.error("ERRO JSON API:", e);
    console.log("CONTEÚDO RECEBIDO:", texto);
    return;
}

    const store = data.store || {};

    const estoqueAtual = store.estoque || [];

    const novoEstoque = [
      ...estoqueAtual.filter(i => i.id !== item.id),
      item
    ];
console.log('LOJA ATUAL:', lojaAtual);
console.log('ESTOQUE ENVIADO:', novoEstoque);
    await fetch('/api/public/store-branding', {
      method:'PUT',
      headers:{
        'Content-Type':'application/json'
      },
      body:JSON.stringify({
        estoque: novoEstoque
      })
    });

  }catch(e){
    console.error('Erro sincronizando estoque online',e);
  }

 return item;
},
  async remove(id){await DB.delete(DB.STORES.ESTOQUE,id);},
  async adjust(id,delta){const item=await this.byId(id);if(!item)return;item.quantidade=Math.max(0,Number(item.quantidade||0)+delta);await this.save(item);},
  async restoreSeed(){await DB.clear(DB.STORES.ESTOQUE);for(const item of LOJA_SEED) await DB.put(DB.STORES.ESTOQUE,item);},
  async customers(){await AppStore.ensureSeed();return await DB.getAll(DB.STORES.CLIENTES);},
  async saveCustomer(c){if(!c.id)c.id=AppStore.uid(c.nome);await DB.put(DB.STORES.CLIENTES,c);},
  async removeCustomer(id){await DB.delete(DB.STORES.CLIENTES,id);}
};
