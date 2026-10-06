(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const context = params.get('context') === 'loja' ? 'loja' : 'produtor';
  const state = { context, store:null, products:[], template:'premium' };
  const key = () => `amp_site_builder_v1_${context}_${state.store?.id || 'default'}`;

  function setContextUI(){
    $('contextBadge').textContent = context === 'loja' ? 'LOJISTA' : 'PRODUTOR';
    $('contextBadge').className = `amp-context ${context === 'loja' ? 'amp-context-store' : 'amp-context-producer'}`;
    $('backHub').href = context === 'loja' ? 'loja.html' : 'produtor.html';
    $('builderSubtitle').textContent = context === 'loja'
      ? 'Crie o site da loja usando cadastro, produtos, identidade, checkout e Provador já existentes.'
      : 'Crie o site comercial do Provador Pro usando planos, módulos, checkout e páginas de vendas.';
    if(context === 'produtor'){
      $('siteName').value ||= 'Provador Pro';
      $('siteTagline').value ||= 'Experimente, venda e cresça com tecnologia';
      $('siteColor').value = '#6d28d9';
      $('siteCheckoutUrl').value ||= '/checkout.html';
      $('siteProvadorUrl').value ||= '/provador/provador.html';
      $('waSellerName').value ||= 'Comercial Provador Pro';
    }else{
      $('siteCheckoutUrl').value ||= '/loja-checkout.html';
      $('siteProvadorUrl').value ||= '/provador/provador.html';
      $('waSellerName').value ||= 'Vendedor da loja';
    }
  }

  async function fetchJson(url){
    const r = await fetch(url, {credentials:'same-origin'});
    if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  function productName(p){ return p?.name || p?.nome || p?.title || p?.produto || p?.sku || 'Produto'; }
  function normalizeProducts(store){
    const pools = [store?.products, store?.roupas, store?.estoque, store?.looks].filter(Array.isArray);
    const seen = new Set(), out=[];
    pools.flat().forEach(p=>{
      const id = String(p?.id ?? p?.sku ?? p?.codigo ?? productName(p));
      if(seen.has(id)) return; seen.add(id);
      out.push({
        id,
        sku:String(p?.sku ?? ''),
        barcode:String(p?.codigoBarras ?? p?.ean ?? p?.barcode ?? ''),
        name:productName(p),
        price:p?.price ?? p?.preco ?? p?.valor ?? '',
        image:p?.image ?? p?.imagem ?? p?.photo ?? ''
      });
    });
    return out.slice(0,24);
  }

  function applyStore(store){
    state.store = store;
    state.products = normalizeProducts(store);
    $('siteName').value = store?.name || $('siteName').value;
    $('siteTagline').value = store?.sub || $('siteTagline').value;
    if(store?.phone) $('siteWhatsapp').value = String(store.phone).replace(/\D/g,'');
    if(store?.color && /^#[0-9a-f]{6}$/i.test(store.color)) $('siteColor').value = store.color;
    if(store?.logo) $('siteLogo').value = store.logo;
    // Checkout online publico; nunca expor o Caixa interno ao cliente.
    if($('siteCheckoutUrl') && (!$('siteCheckoutUrl').value || $('siteCheckoutUrl').value==='/provador/caixa.html')) $('siteCheckoutUrl').value='/loja-checkout.html'; // checkout interno antigo
    if(store?.slug){
      $('siteSubdomain').value ||= `${store.slug}.provadorprosystem.com`;
      $('siteProvadorUrl').value = `/provador/index.html?loja=${encodeURIComponent(store.slug)}`;
    }
    $('productsStatus').textContent = state.products.length
      ? `${state.products.length} item(ns) encontrados para montar o carrossel inicial.`
      : 'Nenhum produto foi retornado agora; o site pode ser salvo e o carrossel será preenchido quando houver produtos disponíveis.';
    restoreDraft();
    // PROVADOR_PUBLICO_LOJISTA_V44
    if(store?.slug && $('siteProvadorUrl')){
      $('siteProvadorUrl').value = `/provador/index.html?loja=${encodeURIComponent(store.slug)}`;
    }
  }

  async function loadData(){
    show('Carregando dados existentes...');
    if(context === 'produtor'){
      restoreDraft();
      show('Base do Produtor carregada. Checkout existente: /checkout.html.');
      return;
    }
    try{
      let data = await fetchJson('/api/public/session-store');
      let store = data?.store || data;
      if(store?.slug){
        try { const pub = await fetchJson(`/api/public/store/${encodeURIComponent(store.slug)}`); store = pub?.store || store; } catch(_){}
      }
      if(!store?.id && !store?.slug) throw new Error('Loja ativa não identificada');
      applyStore(store);
      show(`Dados da loja carregados${state.products.length ? ` com ${state.products.length} produto(s)` : ''}.`);
    }catch(err){
      show(`Não foi possível carregar automaticamente a loja agora: ${err.message}. Você ainda pode preencher e salvar o rascunho.`, true);
    }
  }

  function collect(){
    return {
      version:1, context, storeId:state.store?.id || null, storeSlug:state.store?.slug || null,
      name:$('siteName').value.trim(), tagline:$('siteTagline').value.trim(), whatsapp:$('siteWhatsapp').value.replace(/\D/g,''),
      color:$('siteColor').value, logo:$('siteLogo').value.trim(), domain:$('siteDomain').value.trim(), subdomain:$('siteSubdomain').value.trim(),
      provadorUrl:$('siteProvadorUrl').value.trim(), checkoutUrl:$('siteCheckoutUrl').value.trim(), buyLabel:$('siteBuyLabel').value.trim() || 'Comprar agora',
      featured:$('siteFeatured').value.trim(), seoTitle:$('seoTitle').value.trim(), seoDescription:$('seoDescription').value.trim(),
      waWelcome:$('waWelcome').value.trim(), waQuestion:$('waQuestion').value.trim(), waSellerName:$('waSellerName').value.trim(),
      template:state.template, sections:{benefits:$('secBenefits').checked,products:$('secProducts').checked,socialProof:$('secSocialProof').checked,faq:$('secFaq').checked,whatsapp:$('secWhatsapp').checked},
      waBusinessNumber:$('waBusinessNumber').value.replace(/\D/g,''), waPhoneId:$('waPhoneId').value.trim(), waConnectionState:$('waConnectionState').value, waAiGoal:$('waAiGoal').value.trim(), waProgrammedReplies:$('waProgrammedReplies').value.trim(),
      products:state.products, savedAt:new Date().toISOString()
    };
  }

  function fill(c){
    const map = {siteName:'name',siteTagline:'tagline',siteWhatsapp:'whatsapp',siteColor:'color',siteLogo:'logo',siteDomain:'domain',siteSubdomain:'subdomain',siteProvadorUrl:'provadorUrl',siteCheckoutUrl:'checkoutUrl',siteBuyLabel:'buyLabel',siteFeatured:'featured',seoTitle:'seoTitle',seoDescription:'seoDescription',waWelcome:'waWelcome',waQuestion:'waQuestion',waSellerName:'waSellerName'};
    Object.entries(map).forEach(([id,k])=>{ if(c?.[k] != null && c[k] !== '') $(id).value = c[k]; });
    if(Array.isArray(c?.products) && !state.products.length) state.products = c.products;
    state.template=c?.template||state.template; document.querySelectorAll('.amp-template').forEach(b=>b.classList.toggle('is-active',b.dataset.template===state.template));
    if(c?.sections){Object.entries({benefits:'secBenefits',products:'secProducts',socialProof:'secSocialProof',faq:'secFaq',whatsapp:'secWhatsapp'}).forEach(([k,id])=>{if(c.sections[k]!=null) $(id).checked=!!c.sections[k];});}
    const waMap={waBusinessNumber:'waBusinessNumber',waPhoneId:'waPhoneId',waConnectionState:'waConnectionState',waAiGoal:'waAiGoal',waProgrammedReplies:'waProgrammedReplies'};Object.entries(waMap).forEach(([id,k])=>{if(c?.[k]!=null&&$(id))$(id).value=c[k];}); updateWaState();
  }

  function restoreDraft(){
    try{ const c=JSON.parse(localStorage.getItem(key())||'null'); if(c) fill(c); }catch(_){}
  }
  function compactForStorage(c){
    const safe = JSON.parse(JSON.stringify(c || {}));
    if(/^data:/i.test(String(safe.logo || ''))) safe.logo = '';
    if(Array.isArray(safe.products)){
      safe.products = safe.products.map(p => ({
        ...p,
        image: /^data:/i.test(String(p?.image || '')) ? '' : (p?.image || '')
      }));
    }
    return safe;
  }

  function persistDraft(c){
    const compact = compactForStorage(c);
    const raw = JSON.stringify(compact);
    try{
      localStorage.setItem(key(), raw);
      localStorage.setItem('amp_site_builder_active_v1', raw);
      return {ok:true, compact};
    }catch(err){
      try{
        localStorage.removeItem(key());
        localStorage.removeItem('amp_site_builder_active_v1');
        localStorage.setItem(key(), raw);
        localStorage.setItem('amp_site_builder_active_v1', raw);
        return {ok:true, compact, recovered:true};
      }catch(err2){
        console.warn('Construtor de Sites Pro: rascunho persistente não coube no localStorage.', err2);
        return {ok:false, error:err2};
      }
    }
  }

  function saveDraft(){
    const c = collect();
    const saved = persistDraft(c);
    if(saved.ok){
      show(saved.recovered
        ? 'Rascunho salvo em modo leve. Imagens grandes serão usadas somente na prévia ao vivo.'
        : 'Rascunho salvo neste dispositivo. A prévia já pode ser aberta.');
    }else{
      show('Os dados principais estão mantidos nesta tela, mas o navegador não conseguiu guardar todo o rascunho local. A prévia ainda pode ser aberta.', true);
    }
    return c;
  }

  function preview(){
    const c = saveDraft();
    const f = $('sitePreviewFrame');
    if(!f){
      show('Área de prévia não encontrada nesta página.', true);
      return;
    }

    const sendPreviewData = () => {
      try{
        if(f.contentWindow){
          f.contentWindow.postMessage({
            type:'AMP_SITE_PREVIEW_DATA_V1',
            payload:c
          }, location.origin);
        }
      }catch(err){
        console.error('Construtor de Sites Pro - falha ao enviar dados para a prévia:', err);
      }
    };

    f.onload = sendPreviewData;
    f.src = `site-preview.html?context=${encodeURIComponent(context)}&t=${Date.now()}`;
    f.hidden = false;
    f.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(sendPreviewData, 350);
    show(`Prévia aberta com ${Array.isArray(c.products) ? c.products.length : 0} produto(s).`);
  }
  function show(msg,err=false){ const el=$('builderMessage'); el.hidden=false; el.textContent=msg; el.className=`amp-result ${err?'amp-result-warn':''}`; }


  function updateWaState(){ const v=$('waConnectionState')?.value||'not_connected'; const labels={not_connected:'Não conectado',configuring:'Em configuração',active:'Ativo',blocked:'Bloqueado'}; if($('waIaState')) $('waIaState').textContent=labels[v]||v; if($('waContextLabel')) $('waContextLabel').textContent=context==='loja'?'Lojista':'Produtor'; }
  document.querySelectorAll('.amp-template').forEach(btn=>btn.addEventListener('click',()=>{state.template=btn.dataset.template;document.querySelectorAll('.amp-template').forEach(b=>b.classList.toggle('is-active',b===btn));show(`Template ${btn.querySelector('b')?.textContent||state.template} selecionado.`);}));
  $('waConnectionState')?.addEventListener('change',updateWaState);
  function openWaTestSimulation(){
    const who = context === 'loja' ? 'cliente da loja' : 'interessado no Provador Pro';
    const goal = $('waAiGoal')?.value.trim() || (context === 'loja'
      ? 'qualificar o cliente e ajudar na compra'
      : 'explicar o Provador Pro, identificar o plano e encaminhar para comercial/checkout');
    const welcome = $('waWelcome')?.value.trim() || 'Olá! Vou fazer algumas perguntas rápidas para te ajudar.';
    const question = $('waQuestion')?.value.trim() || 'O que você está procurando hoje?';
    const seller = $('waSellerName')?.value.trim() || (context === 'loja' ? 'Vendedor da loja' : 'Comercial Provador Pro');

    let modal = document.getElementById('waLocalTestModal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'waLocalTestModal';
      modal.innerHTML = `
        <div class="wa-local-backdrop"></div>
        <section class="wa-local-card" role="dialog" aria-modal="true" aria-labelledby="waLocalTitle">
          <button type="button" class="wa-local-close" aria-label="Fechar">×</button>
          <div class="wa-local-head">
            <span>💬 TESTE LOCAL</span>
            <b id="waLocalTitle">Atendimento IA no WhatsApp</b>
            <small>Nenhuma mensagem externa será enviada.</small>
          </div>
          <div class="wa-local-chat" id="waLocalChat"></div>
          <div class="wa-local-actions">
            <button type="button" data-wa-action="interest">Tenho interesse</button>
            <button type="button" data-wa-action="checkout">Quero comprar</button>
            <button type="button" data-wa-action="human">Falar com humano</button>
          </div>
          <div class="wa-local-status" id="waLocalStatus"></div>
        </section>`;
      const style = document.createElement('style');
      style.textContent = `
        #waLocalTestModal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;font-family:inherit}
        #waLocalTestModal[hidden]{display:none}
        #waLocalTestModal .wa-local-backdrop{position:absolute;inset:0;background:rgba(3,6,18,.72);backdrop-filter:blur(4px)}
        #waLocalTestModal .wa-local-card{position:relative;width:min(680px,calc(100vw - 28px));max-height:86vh;overflow:auto;background:#111827;color:#fff;border:1px solid rgba(139,92,246,.55);border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,.45);padding:20px}
        #waLocalTestModal .wa-local-close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:#fff;font-size:28px;cursor:pointer}
        #waLocalTestModal .wa-local-head{display:grid;gap:4px;padding-right:40px;margin-bottom:16px}
        #waLocalTestModal .wa-local-head span{font-size:12px;font-weight:800;letter-spacing:.12em;color:#a78bfa}
        #waLocalTestModal .wa-local-head b{font-size:24px}
        #waLocalTestModal .wa-local-head small{color:#aab2c5}
        #waLocalTestModal .wa-local-chat{display:grid;gap:10px;background:#0b1220;border-radius:16px;padding:14px;min-height:210px}
        #waLocalTestModal .wa-msg{max-width:86%;padding:10px 12px;border-radius:14px;line-height:1.35}
        #waLocalTestModal .wa-msg.bot{background:#243047;border-bottom-left-radius:4px}
        #waLocalTestModal .wa-msg.user{background:#6d28d9;margin-left:auto;border-bottom-right-radius:4px}
        #waLocalTestModal .wa-local-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
        #waLocalTestModal .wa-local-actions button{border:1px solid #7c3aed;background:#1f2937;color:#fff;border-radius:10px;padding:10px 12px;font-weight:700;cursor:pointer}
        #waLocalTestModal .wa-local-actions button:hover{background:#6d28d9}
        #waLocalTestModal .wa-local-status{margin-top:12px;color:#c4b5fd;font-size:13px;line-height:1.4}
      `;
      document.head.appendChild(style);
      document.body.appendChild(modal);

      const close = ()=>{ modal.hidden = true; };
      modal.querySelector('.wa-local-close').addEventListener('click', close);
      modal.querySelector('.wa-local-backdrop').addEventListener('click', close);
      document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !modal.hidden) close(); });
    }

    const chat = modal.querySelector('#waLocalChat');
    const status = modal.querySelector('#waLocalStatus');
    chat.innerHTML = `
      <div class="wa-msg bot">${welcome}</div>
      <div class="wa-msg bot">${question}</div>`;
    status.textContent = `Objetivo da IA: ${goal}. Etapa inicial registrada: atendimento iniciado.`;
    modal.hidden = false;

    modal.querySelectorAll('[data-wa-action]').forEach(btn=>{
      btn.onclick = ()=>{
        const action = btn.dataset.waAction;
        if(action === 'interest'){
          chat.insertAdjacentHTML('beforeend', `<div class="wa-msg user">Tenho interesse.</div><div class="wa-msg bot">Perfeito. Vou registrar seu interesse e mostrar a melhor próxima etapa.</div>`);
          status.textContent = 'Funil: interesse identificado → lead qualificado.';
        }else if(action === 'checkout'){
          chat.insertAdjacentHTML('beforeend', `<div class="wa-msg user">Quero comprar.</div><div class="wa-msg bot">Ótimo. A próxima etapa será encaminhar você para o checkout correto deste contexto.</div>`);
          status.textContent = 'Funil: intenção de compra → encaminhamento para checkout.';
        }else{
          chat.insertAdjacentHTML('beforeend', `<div class="wa-msg user">Quero falar com uma pessoa.</div><div class="wa-msg bot">Certo. Vou transferir para ${seller} com um resumo desta conversa para você não precisar repetir tudo.</div>`);
          status.textContent = `Funil: transferência humana solicitada → destino: ${seller}.`;
        }
        try{
          localStorage.setItem('amp_wa_local_test_last_event_v1', JSON.stringify({
            context, action, goal, seller, at:new Date().toISOString()
          }));
        }catch(_){}
      };
    });

    show(`Teste local aberto para o ${who}. Nenhuma mensagem externa foi enviada.`);
  }

  $('waTestBtn')?.addEventListener('click', openWaTestSimulation);

  $('loadDataBtn').addEventListener('click', loadData);
  $('saveDraftBtn').addEventListener('click', saveDraft);
  $('previewBtn').addEventListener('click', preview);
  setContextUI(); restoreDraft(); updateWaState();
  if(context==='loja') loadData();
})();
