(() => {
'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const state={store:null,item:null,qty:1,slug:String(params.get('loja')||'').trim()};
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const txt=v=>String(v??'').trim();
const norm=v=>txt(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const digits=v=>txt(v).replace(/\D+/g,'');
function priceValue(v){if(typeof v==='number')return v;let s=txt(v).replace(/R\$/gi,'').replace(/\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0}
function show(msg){$('alertBox').textContent=msg;$('alertBox').hidden=false;$('alertBox').scrollIntoView({behavior:'smooth',block:'center'})}
function itemName(i){return i?.nome||i?.name||i?.title||i?.produto||i?.sku||'Produto'}
function itemImage(i){return i?.imagem||i?.image||i?.imageData||i?.foto||''}
function itemPrice(i){return priceValue(i?.preco??i?.price??i?.valor??0)}
function findItem(store){
  const pools=[store?.estoque,store?.products,store?.roupas].filter(Array.isArray).flat();
  const id=txt(params.get('ppPosItemId')),sku=txt(params.get('ppPosSku')),barcode=txt(params.get('ppPosBarcode')),name=txt(params.get('ppPosName'));
  let found=null;
  if(id)found=pools.find(i=>String(i?.id??'')===id)||null;
  if(!found&&sku)found=pools.find(i=>norm(i?.sku)===norm(sku))||null;
  if(!found&&barcode)found=pools.find(i=>digits(i?.codigoBarras||i?.ean)===digits(barcode))||null;
  if(!found&&name)found=pools.find(i=>norm(itemName(i))===norm(name))||null;
  return found;
}
function applyBrand(){
  const s=state.store||{};document.documentElement.style.setProperty('--brand',s.color||'#e33d8f');
  $('storeName').textContent=s.name||'Sua loja';$('storeSub').textContent=s.sub||'Finalize seu pedido com segurança.';
  if(s.logo){$('storeLogo').src=s.logo;$('storeLogo').hidden=false}
  $('backToStore').href=`/loja.html?loja=${encodeURIComponent(s.slug||state.slug)}`;
}
function renderProduct(){
  const i=state.item;if(!i){$('productBox').innerHTML='<div class="loading">Produto não encontrado.</div>';return}
  const stock=Math.max(0,Number(i.quantidade??i.stock??0)),price=itemPrice(i),img=itemImage(i);
  $('productBox').innerHTML=`<div class="product-line">${img?`<img src="${String(img).replace(/"/g,'&quot;')}" alt="">`:'<div style="width:110px;height:125px;border-radius:16px;background:#f2edf2;display:grid;place-items:center;font-size:44px">🛍️</div>'}<div><div class="product-name">${itemName(i)}</div><div class="meta">SKU ${txt(i.sku)||'-'} • Estoque disponível: ${stock}</div><div class="price">${money(price)}</div><div class="qty"><button id="qtyMinus" type="button">−</button><strong id="qtyValue">${state.qty}</strong><button id="qtyPlus" type="button">+</button></div></div></div>`;
  $('qtyMinus').onclick=()=>{state.qty=Math.max(1,state.qty-1);renderProduct();renderSummary()};
  $('qtyPlus').onclick=()=>{if(state.qty>=stock){show(`Estoque disponível: ${stock}.`);return}state.qty++;renderProduct();renderSummary()};
}
function renderSummary(){
  const i=state.item,price=i?itemPrice(i):0,total=price*state.qty;
  $('summary').innerHTML=`<div class="summary-row"><span>Produto</span><strong>${i?itemName(i):'-'}</strong></div><div class="summary-row"><span>Quantidade</span><strong>${state.qty}</strong></div><div class="summary-row"><span>Unitário</span><strong>${money(price)}</strong></div><div class="summary-total">Total: ${money(total)}</div>`;
}
async function load(){
  if(!state.slug){show('Loja não identificada no checkout.');return}
  const r=await fetch(`/api/public/store/${encodeURIComponent(state.slug)}`,{cache:'no-store'});const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'Loja não encontrada.');
  state.store=data.store||{};applyBrand();state.item=findItem(state.store);
  if(!state.item)throw new Error('O produto escolhido não foi localizado nesta loja.');
  const stock=Math.max(0,Number(state.item.quantidade??0));if(stock<=0)throw new Error(`${itemName(state.item)} está sem estoque disponível.`);
  renderProduct();renderSummary();
}
function deliveryChanged(){
  const v=document.querySelector('input[name="delivery"]:checked')?.value||'retirada';
  $('addressFields').hidden=v!=='entrega';
  document.querySelectorAll('.choice').forEach(x=>x.classList.toggle('active',x.querySelector('input')?.checked));
}
document.querySelectorAll('input[name="delivery"]').forEach(x=>x.addEventListener('change',deliveryChanged));
deliveryChanged();
$('createOrderBtn').onclick=async()=>{
  if(!state.store||!state.item)return;
  $('alertBox').hidden=true;
  const name=txt($('customerName').value),phone=txt($('customerPhone').value),email=txt($('customerEmail').value).toLowerCase(),cpf=txt($('customerCpf').value);
  const delivery=document.querySelector('input[name="delivery"]:checked')?.value||'retirada';
  if(!name||!phone||!email){show('Preencha nome, WhatsApp e e-mail.');return}
  const address=delivery==='entrega'?{cep:txt($('cep').value),address:txt($('address').value),number:txt($('number').value),neighborhood:txt($('neighborhood').value),city:txt($('city').value),state:txt($('state').value).toUpperCase(),complement:txt($('complement').value)}:{};
  if(delivery==='entrega'&&(!address.cep||!address.address||!address.number||!address.city||!address.state)){show('Preencha os dados principais de entrega.');return}
  const btn=$('createOrderBtn');btn.disabled=true;btn.textContent='Criando pedido...';
  try{
    const body={itemId:String(state.item.id||''),sku:txt(state.item.sku),quantity:state.qty,customerName:name,customerPhone:phone,customerEmail:email,customerCpf:cpf,delivery,address};
    const r=await fetch(`/api/public/store-checkout/${encodeURIComponent(state.store.slug)}/orders`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Não foi possível criar o pedido.');
    const order=data.order||{},phoneStore=digits(state.store.phone||''),summary=`Olá! Fiz um pedido online na ${state.store.name||'loja'}.\nPedido: ${order.id||''}\nProduto: ${itemName(state.item)}\nQuantidade: ${state.qty}\nTotal: ${money(Number(order.amountCents||0)/100)}\nNome: ${name}\nRecebimento: ${delivery==='entrega'?'Entrega':'Retirada na loja'}`;
    $('successText').textContent=`Pedido ${order.id||''} criado. O pagamento online da loja ainda não está conectado; nenhum valor foi cobrado e o estoque não foi baixado.`;
    $('whatsappOrder').href=phoneStore?`https://wa.me/${phoneStore}?text=${encodeURIComponent(summary)}`:'#';
    $('successCard').hidden=false;$('successCard').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(e){show(e.message||String(e))}
  finally{btn.disabled=false;btn.textContent='Criar pedido'}
};
load().catch(e=>show(e.message||String(e)));
})();
