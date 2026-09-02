
window.UI={page:0,pageSize:4,async renderTrack(trackId,items,clickFnName){const track=document.getElementById(trackId); if(!track)return; const start=this.page*this.pageSize; const slice=items.slice(start,start+this.pageSize); track.innerHTML=slice.map(i=>`<button class="card" onclick="${clickFnName}('${i.id || i.nome}')"><div class="name">${i.nome}</div><img src="${i.imagem}" alt="${i.nome}"></button>`).join('');}};
async function renderHome(){await AppStore.ensureSeed(); const items=await Estoque.visible(); UI.page=Math.min(UI.page,Math.max(0,Math.ceil(items.length/UI.pageSize)-1)); await UI.renderTrack('homeTrack',items,'previewLook'); const first=items.find(i=>i.destaque)||items[0]; if(first) previewItem(first);}
async function previewLook(id){const item=await Estoque.byId(id); if(item) previewItem(item);}
function previewItem(item){const img=document.getElementById('landingLook'); const badge=document.getElementById('homeBadge'); if(img){img.src=item.imagem; img.style.display='block';} if(badge) badge.textContent=`Destaque: ${item.nome}`;}
async function nextHome(){const items=await Estoque.visible(); const max=Math.max(0,Math.ceil(items.length/UI.pageSize)-1); UI.page=Math.min(max,UI.page+1); await renderHome();}
async function prevHome(){UI.page=Math.max(0,UI.page-1); await renderHome();}
function filtrarItensCatalogo(items){
  return (Array.isArray(items)?items:[]).filter(item=>{
    const qtd=item?.quantidade ?? item?.quantity ?? item?.estoque;
    if(qtd===undefined || qtd===null || qtd==='') return true;
    return Number(qtd)>0;
  });
}
async function carregarItensCatalogo(){
  return filtrarItensCatalogo(await carregarLooksOnline());
}
async function renderCatalogo(){
  const items=await carregarItensCatalogo();
  const track=document.getElementById('catalogTrack');
  const carousel=track ? track.closest('.carousel') : null;

  if(!items.length){
    if(track){
      track.innerHTML='<div class="catalog-empty-state"><strong>Nenhuma peça disponível</strong><span>Cadastre roupas no painel da loja para exibi-las neste catálogo.</span></div>';
    }
    if(carousel) carousel.classList.add('catalog-empty');
    return;
  }

  if(carousel) carousel.classList.remove('catalog-empty');
  UI.page=Math.min(UI.page,Math.max(0,Math.ceil(items.length/UI.pageSize)-1));
  await UI.renderTrack('catalogTrack',items,'abrirProvadorItem');
}

async function abrirProvadorItem(id){const items=await carregarItensCatalogo(); const item=items.find(i=>String(i.id || i.nome)===String(id)); if(item){AppStore.setSelected(item); if(window.ProNavigation){ProNavigation.go('provador.html');}else{location.href='provador.html?loja='+encodeURIComponent(new URLSearchParams(location.search).get('loja') || localStorage.getItem('loja_slug') || '');}}}
async function nextCatalog(){const items=await carregarItensCatalogo(); const max=Math.max(0,Math.ceil(items.length/UI.pageSize)-1); UI.page=Math.min(max,UI.page+1); await renderCatalogo();}
async function prevCatalog(){UI.page=Math.max(0,UI.page-1); await renderCatalogo();}
async function initProvador(){
  await AppStore.ensureSeed();

  const items = await carregarLooksOnline();
  console.log('ITENS DO PROVADOR:', items);

  const lista = Array.isArray(items) ? items : [];
  const badge = document.getElementById('provadorBadge');
  const btnLooks = document.getElementById('btnLooks');
  const btnTrocar = document.querySelector('.actions .neutral');

  if(lista.length === 0){
    document.body.classList.add('provador-sem-look');
    if(badge) badge.textContent = 'Escolha um look para começar';
    if(btnLooks) btnLooks.style.display = 'none';
    if(btnTrocar) btnTrocar.textContent = 'ESCOLHER LOOK';

    await UI.renderTrack(
      'provadorTrack',
      [],
      'selecionarLook'
    );

    return;
  }

  document.body.classList.remove('provador-sem-look');
  if(btnLooks) btnLooks.style.display = '';
  if(btnTrocar) btnTrocar.textContent = 'TROCAR LOOK';

  UI.page = Math.min(
    UI.page,
    Math.max(0, Math.ceil(lista.length / UI.pageSize) - 1)
  );

  await UI.renderTrack(
    'provadorTrack',
    lista,
    'selecionarLook'
  );

  const salvo = AppStore.getSelected();
  const selected =
    salvo &&
    lista.some(i => i.id == salvo.id || i.nome == salvo.nome)
      ? salvo
      : lista[0];

  if(selected){
    await selecionarLook(selected.id || selected.nome);
  }
}
if (window.CameraModule) {
    CameraModule.start('video','poseCanvas','cameraTip');
}
async function selecionarLook(id){

  const looks = await carregarLooksOnline();

  const item = looks.find(i =>
      i.id == id ||
      i.nome == id
  );

  if(!item){
      console.log('Look não encontrado:', id);
      return;
  }

  AppStore.setSelected(item);

  const title = document.getElementById('provadorTitle');
  const badge = document.getElementById('provadorBadge');

  if(title) title.textContent = item.nome;
  if(badge) badge.textContent = item.nome;

  console.log('LOOK SELECIONADO:', item);
    const painel = document.getElementById('looksPanel');
if (painel) painel.style.display = 'none';

  CameraModule.setLook(item.imagem);
}
async function nextProvador(){

  const items = await carregarLooksOnline();

  const max = Math.max(
      0,
      Math.ceil(items.length/UI.pageSize)-1
  );

  UI.page = Math.min(max, UI.page + 1);

  await UI.renderTrack(
     'provadorTrack',
      items,
      'selecionarLook'
  );
    document.getElementById('looksPanel').style.display = 'none';
}
async function prevProvador(){

  UI.page = Math.max(0, UI.page - 1);

  const items = await carregarLooksOnline();

  await UI.renderTrack(
     'provadorTrack',
      items,
      'selecionarLook'
  );
}
async function carregarClientesSelect(){const sel=document.getElementById('clienteSelect'); if(!sel)return; const customers=await Estoque.customers(); sel.innerHTML='<option value="">Sem cliente selecionada</option>'+customers.map(c=>`<option value="${c.telefone||''}">${c.nome}</option>`).join('');}
function fotoLook(){CameraModule.savePhoto('poseCanvas'); alert('Foto salva no computador.');}
function enviarWhats(){const phone=(document.getElementById('clienteSelect')||{}).value||''; WhatsAppModule.saveAndOpen(phone);}
async function renderDescanso(){await AppStore.ensureSeed(); const holder=document.getElementById('restHolder'); const label=document.getElementById('restLabel'); if(!holder)return; const meta=await DB.getKV('rest_meta'); if(label&&meta) label.textContent=meta.name||'Sua Loja'; const file=await DB.getKV('rest_file'); if(meta&&meta.mode==='custom'&&file){const url=URL.createObjectURL(file); holder.innerHTML=meta.type==='video'?`<video src="${url}" autoplay muted loop playsinline controls></video>`:`<img src="${url}" alt="${meta.name||''}">`;} else {holder.innerHTML=`<img src="imagens/logo.png" alt="Sua Loja">`;}}
async function carregarLooksOnline() {

    try {

        const slug =
            new URLSearchParams(location.search).get('loja') ||
            localStorage.getItem('loja_slug');

        if (!slug) {
            console.error('Slug não encontrado');
            return [];
        }

        const response = await fetch(`/api/public/store/${slug}`);

        if (!response.ok) {
            console.error('Erro API', response.status);
            return [];
        }

        const result = await response.json();

        if (!result.store) {
            console.error('Store não encontrada');
            return [];
        }

        let looks = [];
        const fontes = [
            result.store.looks,
            result.store.estoque,
            result.store.products,
            result.store.roupas
        ];

        for (let valor of fontes) {
            while (typeof valor === 'string') {
                try {
                    valor = JSON.parse(valor);
                } catch (e) {
                    valor = [];
                    break;
                }
            }

            if (Array.isArray(valor) && valor.length > 0) {
                looks = valor;
                break;
            }
        }
        console.log('DADOS COMPLETOS:', looks);

        console.log('LOOKS CARREGADOS:', looks);

        return looks;

    } catch (err) {

        console.error('Erro Provador:', err);

        return [];
    }
}

