(()=>{'use strict';
const form=document.getElementById('ppV115CampaignForm'),list=document.getElementById('ppV115CampaignList'),status=document.getElementById('ppV115Status'),tabs=document.getElementById('ppV115CategoryTabs'),picker=document.getElementById('ppV115StorePicker'),options=document.getElementById('ppV115StoreOptions'),help=document.getElementById('ppV115CategoryHelp');
if(!form||!list||!tabs)return;
const api='/api/admin/store-banners-v115';let items=[],stores=[],category='all';
const labels={all:'Todas as lojas',specific:'Lojas específicas',plan:'Por plano',free:'Plano Grátis Permanente',trial:'Teste Grátis — 15 Dias'};
const disabled=new Set(['plan','free','trial']);
// BUSCA DE LOJAS V1.15.2B: filtro local; nunca altera os IDs escolhidos.
const filterWrap=document.createElement('div');
filterWrap.id='ppV115StoreSearchWrap';
filterWrap.style.cssText='display:grid;gap:8px;margin:10px 0';
const search=document.createElement('input');
search.type='search';search.id='ppV115StoreSearch';
search.placeholder='Digite a primeira letra ou o nome da loja...';
search.setAttribute('aria-label','Pesquisar lojas pelo nome');
search.setAttribute('autocomplete','off');
search.style.cssText='width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #e7c2d4';
const searchInfo=document.createElement('small');searchInfo.id='ppV115StoreSearchInfo';
searchInfo.setAttribute('aria-live','polite');
filterWrap.append(search,searchInfo);
options.parentNode.insertBefore(filterWrap,options);
function normalizeStoreName(x){return String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim()}
function updateStoreSearch(){
  const q=normalizeStoreName(search.value);let matching=0;
  for(const label of options.querySelectorAll('label')){
    const name=normalizeStoreName(label.textContent);
    const match=!!q&&name.includes(q);
    label.hidden=!match;
    label.style.display=match?'':'none';
    if(match)matching++;
  }
  const count=selectedIds().length;
  searchInfo.textContent=count+' loja(s) selecionada(s). '+(!q?'Digite para localizar; a lista fica recolhida.':matching?matching+' loja(s) encontrada(s).':'Nenhuma loja encontrada.');
}
search.addEventListener('input',updateStoreSearch);
options.addEventListener('change',updateStoreSearch);

const say=s=>{status.textContent=s};
const getCategory=x=>x.category||(x.target==='stores'?'specific':'all');
function controls(){tabs.querySelectorAll('button').forEach(b=>{const active=b.dataset.category===category;b.setAttribute('aria-selected',String(active));b.setAttribute('role','tab')});picker.hidden=category!=='specific';const blocked=disabled.has(category);help.textContent=blocked?'Esta categoria está preparada, mas o envio foi bloqueado até a validação das regras reais de planos e licenças. Nenhuma campanha será enviada para o público errado.':category==='specific'?'Escolha as lojas na gaveta abaixo. Os IDs serão identificados automaticamente.':'Campanhas gerais são enviadas a todas as lojas elegíveis.';form.hidden=blocked;render()}
function selectedIds(){return [...options.querySelectorAll('input[type=checkbox]:checked')].map(x=>x.value)}
function values(){const d=new FormData(form);return {category,title:d.get('title'),description:d.get('description'),tag:d.get('tag'),buttonText:d.get('buttonText'),url:d.get('url'),icon:d.get('icon'),target:category==='specific'?'stores':'all',storeIds:category==='specific'?selectedIds():[],startsAt:d.get('startsAt'),endsAt:d.get('endsAt'),order:Number(d.get('order')||0),active:d.has('active')}}
function reset(){form.reset();form.elements.id.value='';form.elements.category.value=category;options.querySelectorAll('input').forEach(x=>x.checked=false);search.value='';updateStoreSearch()}
function dt(v){return v?new Date(v).toISOString().slice(0,16):''}
function edit(x){category=getCategory(x);controls();['title','description','tag','buttonText','url','icon','order'].forEach(k=>form.elements[k].value=x[k]??'');form.elements.id.value=x.id;form.elements.startsAt.value=dt(x.startsAt);form.elements.endsAt.value=dt(x.endsAt);form.elements.active.checked=!!x.active;options.querySelectorAll('input').forEach(c=>c.checked=(x.storeIds||[]).map(String).includes(c.value));search.value='';updateStoreSearch();form.scrollIntoView({behavior:'smooth'});say('Editando: '+x.title)}
function btn(label,handler){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',handler);return b}
function render(){list.replaceChildren();const visible=items.filter(x=>getCategory(x)===category);if(!visible.length){list.textContent='Sem campanhas nesta categoria.';return}for(const x of visible){const row=document.createElement('div');row.className='pp-v115-item';const title=document.createElement('strong');title.textContent=(x.active?'● ':'○ ')+x.title;const desc=document.createElement('p');desc.textContent=x.description;const info=document.createElement('small');const names=(x.storeIds||[]).map(id=>stores.find(s=>String(s.id)===String(id))?.name||'Loja '+id);info.textContent='Destino: '+(x.target==='all'?'Todas as lojas':names.join(', '))+' | Validade: '+(x.startsAt?new Date(x.startsAt).toLocaleString('pt-BR'):'imediata')+' a '+(x.endsAt?new Date(x.endsAt).toLocaleString('pt-BR'):'sem fim');row.append(title,desc,info,btn('Editar',()=>edit(x)),btn('Excluir',()=>{if(confirm('Excluir campanha?'))request('DELETE',api+'/'+encodeURIComponent(x.id))}));list.append(row)}}
async function refresh(){try{const prevIds=new Set(selectedIds());const [r,s]=await Promise.all([fetch(api,{credentials:'same-origin'}),fetch('/api/admin/stores',{credentials:'same-origin'})]);if(!r.ok||!s.ok)throw Error('Sessão do Produtor não autorizada');items=(await r.json()).items||[];stores=(await s.json()).stores||[];options.replaceChildren();for(const store of stores){const label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.value=String(store.id);cb.checked=prevIds.has(cb.value);label.append(cb,document.createTextNode(' '+store.name));options.append(label)}updateStoreSearch();render()}catch(e){say('Erro: '+e.message)}}
async function request(method,url,payload){try{const r=await fetch(url,{method,credentials:'same-origin',headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});const result=await r.json();if(!r.ok)throw Error(result.error||'Não foi possível salvar');reset();await refresh();say('Operação concluída')}catch(e){say('Erro: '+e.message)}}
tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-category]');if(!b)return;category=b.dataset.category;reset();controls();say('Categoria: '+labels[category])});form.addEventListener('submit',e=>{e.preventDefault();if(disabled.has(category))return say('Categoria ainda não habilitada');const id=form.elements.id.value;request(id?'PUT':'POST',api+(id?'/'+encodeURIComponent(id):''),values())});document.getElementById('ppV115Reset')?.addEventListener('click',()=>{reset();say('Formulário limpo')});document.getElementById('ppV115Refresh')?.addEventListener('click',refresh);controls();updateStoreSearch();refresh();
})();
