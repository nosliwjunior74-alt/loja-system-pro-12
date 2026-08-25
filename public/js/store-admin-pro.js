/* =========================================================
   PROVADOR PRO SYSTEM
   PAINEL ADMINISTRATIVO DA LOJA - PRO
   ========================================================= */

(function(){

  const DEFAULT_SUPPORT = {
    greeting: 'Olá! Seja bem-vindo(a) à nossa loja. Como podemos ajudar?',
    purchaseMessage: 'Olá! Tenho interesse neste look:',
    address: '',
    hours: '',
    chatTitle: 'Atendimento da Loja',
    chatEnabled: true,
    quickReplies: [
      {
        question: 'Como comprar?',
        answer: 'Escolha o look desejado e fale conosco pelo WhatsApp para finalizar o atendimento.'
      },
      {
        question: 'Quais tamanhos estão disponíveis?',
        answer: 'A disponibilidade de tamanhos aparece junto ao look. Se precisar, fale conosco pelo WhatsApp.'
      },
      {
        question: 'Qual o horário de atendimento?',
        answer: 'Consulte o horário informado pela loja ou fale conosco pelo WhatsApp.'
      }
    ]
  };

  let proStore = null;
  let quickReplies = [];
  let adminCustomersCache = [];


  function slugAtual(){
    const p = new URLSearchParams(location.search);

    return (
      p.get('loja') ||
      p.get('slug') ||
      localStorage.getItem('loja_slug') ||
      ''
    );
  }


  function escapeHtml(value){
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }


  function mergeSupport(cfg){
    const recebido =
      cfg &&
      typeof cfg === 'object' &&
      !Array.isArray(cfg)
        ? cfg
        : {};

    return {
      ...DEFAULT_SUPPORT,
      ...recebido,
      quickReplies:
        Array.isArray(recebido.quickReplies)
          ? recebido.quickReplies
          : DEFAULT_SUPPORT.quickReplies
    };
  }


  function formatDate(value){
    if(!value) return 'Não informada';

    const partes =
      String(value).split('-');

    if(partes.length !== 3){
      return value;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }


  function publicStoreLink(store){
    const slug = store?.slug || slugAtual();

    /*
      Link direto da vitrine do comprador.
      Não usa /s/:slug porque essa rota atualmente
      leva ao login administrativo da loja.
    */
    return (
      location.origin +
      '/loja.html?loja=' +
      encodeURIComponent(slug)
    );
  }


  function createOverviewButton(){
    const menu =
      document.querySelector('.sidebar .menu');

    if(!menu) return;

    if(
      document.getElementById(
        'adminOverviewBtn'
      )
    ) return;

    const btn =
      document.createElement('button');

    btn.id = 'adminOverviewBtn';
    btn.className = 'menu-btn';
    btn.type = 'button';
    btn.innerHTML = '🏠 Visão Geral';

    menu.prepend(btn);

    btn.addEventListener(
      'click',
      showOverview
    );
  }


  function getFrameWrap(){
    const frame =
      document.getElementById('appFrame');

    return frame
      ? frame.parentElement
      : null;
  }


  function getOldPublicCard(){
    const main =
      document.querySelector('.main-area');

    if(!main) return null;

    const cards =
      Array.from(
        main.querySelectorAll(':scope > .card')
      );

    return cards[0] || null;
  }


  function showOverview(){

    const home =
      document.getElementById(
        'adminProHome'
      );

    const frameWrap =
      getFrameWrap();

    const oldCard =
      getOldPublicCard();

    if(home){
      home.style.display = 'block';
    }

    if(frameWrap){
      frameWrap.style.display = 'none';
    }

    if(oldCard){
      oldCard.style.display = 'none';
    }

    document
      .querySelectorAll('.menu-btn')
      .forEach(btn =>
        btn.classList.remove('active')
      );

    const overviewBtn =
      document.getElementById(
        'adminOverviewBtn'
      );

    if(overviewBtn){
      overviewBtn.classList.add('active');
    }

    const title =
      document.getElementById(
        'currentTitle'
      );

    if(title){
      title.textContent =
        'Visão Geral';
    }

  }


  function showToolView(){

    const home =
      document.getElementById(
        'adminProHome'
      );

    const frameWrap =
      getFrameWrap();

    const oldCard =
      getOldPublicCard();

    if(home){
      home.style.display = 'none';
    }

    if(frameWrap){
      frameWrap.style.display = 'block';
    }

    if(oldCard){
      oldCard.style.display = 'none';
    }

  }


  function bindExistingMenu(){

    document
      .querySelectorAll(
        '.sidebar .menu .menu-btn'
      )
      .forEach(btn => {

        if(
          btn.id ===
          'adminOverviewBtn'
        ){
          return;
        }

        btn.addEventListener(
          'click',
          showToolView
        );

      });

  }


  function renderQuickReplies(){

    const box =
      document.getElementById(
        'quickRepliesEditor'
      );

    if(!box) return;

    box.innerHTML = '';

    quickReplies.forEach(
      (item,index) => {

        const row =
          document.createElement('div');

        row.className =
          'quick-reply-row';

        row.innerHTML = `
          <input
            type="text"
            maxlength="160"
            data-role="question"
            data-index="${index}"
            value="${escapeHtml(item.question)}"
            placeholder="Pergunta rápida">

          <textarea
            maxlength="800"
            data-role="answer"
            data-index="${index}"
            placeholder="Resposta">${escapeHtml(item.answer)}</textarea>

          <button
            type="button"
            data-remove="${index}">
            Remover
          </button>
        `;

        box.appendChild(row);

      });

    box
      .querySelectorAll(
        '[data-role]'
      )
      .forEach(input => {

        input.addEventListener(
          'input',
          e => {

            const index =
              Number(
                e.target.dataset.index
              );

            const role =
              e.target.dataset.role;

            if(
              !quickReplies[index]
            ) return;

            quickReplies[index][role] =
              e.target.value;

          });

      });

    box
      .querySelectorAll(
        '[data-remove]'
      )
      .forEach(btn => {

        btn.addEventListener(
          'click',
          () => {

            const index =
              Number(
                btn.dataset.remove
              );

            quickReplies.splice(
              index,
              1
            );

            renderQuickReplies();

          });

      });

  }


  function addQuickReply(){

    if(
      quickReplies.length >= 12
    ){
      alert(
        'O limite é de 12 respostas rápidas por loja.'
      );
      return;
    }

    quickReplies.push({
      question: '',
      answer: ''
    });

    renderQuickReplies();


  }


  function setStatus(
    text,
    type = ''
  ){

    const el =
      document.getElementById(
        'adminSaveStatus'
      );

    if(!el) return;

    el.className =
      'admin-save-status ' +
      type;

    el.textContent = text;

  }


  function fillForm(store){

    const cfg =
      mergeSupport(
        store.supportConfig
      );

    quickReplies =
      cfg.quickReplies.map(
        item => ({
          question:
            String(
              item?.question || ''
            ),

          answer:
            String(
              item?.answer || ''
            )
        })
      );

    const values = {
      supportPhone:
        store.phone || '',

      supportGreeting:
        cfg.greeting || '',

      supportPurchaseMessage:
        cfg.purchaseMessage || '',

      supportAddress:
        cfg.address || '',

      supportHours:
        cfg.hours || '',

      supportChatTitle:
        cfg.chatTitle || ''
    };

    Object.entries(values)
      .forEach(([id,value]) => {

        const el =
          document.getElementById(id);

        if(el){
          el.value = value;
        }

      });

    const enabled =
      document.getElementById(
        'supportChatEnabled'
      );

    if(enabled){
      enabled.checked =
        cfg.chatEnabled !== false;
    }

    renderQuickReplies();

    renderSupportCompactSummary();

  }


  function renderStoreInfo(store){

    const name =
      store.name || 'Sua Loja';

    const slug =
      store.slug || '';

    const status =
      store.status === 'inativo'
        ? 'Bloqueada'
        : (
          store.status === 'degustacao'
            ? 'Em degustação'
            : 'Ativa'
        );

    const publicLink =
      publicStoreLink(store);

    const map = {
      adminHeroName:
        name,

      adminStoreStatus:
        status,

      adminStoreSlug:
        slug || 'Não informado',

      adminStoreLicense:
        store.licenseStatus ||
        'Ativa',

      adminStoreExpiry:
        formatDate(
          store.expiresAt
        ),

      adminPublicLink:
        publicLink
    };

    Object.entries(map)
      .forEach(([id,value]) => {

        const el =
          document.getElementById(id);

        if(!el) return;

        if(
          id === 'adminPublicLink'
        ){
          el.value = value;
        }else{
          el.textContent = value;
        }

      });

  }


  function setSupportConfigOpen(open){

    const area =
      document.getElementById(
        'supportConfigFormArea'
      );

    if(!area) return;

    area.style.display =
      open ? 'block' : 'none';
  }


  function renderSupportCompactSummary(){

    const title =
      document.getElementById(
        'adminSupportSummaryTitle'
      );

    const text =
      document.getElementById(
        'adminSupportSummaryText'
      );

    const phone =
      String(
        proStore?.phone || ''
      ).trim();

    const cfg =
      proStore?.supportConfig &&
      typeof proStore.supportConfig === 'object'
        ? proStore.supportConfig
        : {};

    if(title){
      title.textContent =
        phone
          ? 'WhatsApp: ' + phone
          : 'WhatsApp nao configurado';
    }

    if(text){

      const chat =
        cfg.chatEnabled === false
          ? 'Chat desativado'
          : 'Chat ativado';

      const total =
        Array.isArray(cfg.quickReplies)
          ? cfg.quickReplies.length
          : quickReplies.length;

      text.textContent =
        chat +
        ' - ' +
        total +
        (
          total === 1
            ? ' resposta rapida'
            : ' respostas rapidas'
        );
    }
  }


  function openSupportConfig(){

    if(proStore){
      fillForm(proStore);
    }

    setSupportConfigOpen(true);
    setStatus('');

    setTimeout(
      () =>
        document.getElementById(
          'supportPhone'
        )?.focus(),
      0
    );
  }


  function closeSupportConfig(){

    if(proStore){
      fillForm(proStore);
    }

    setSupportConfigOpen(false);
    setStatus('');
  }


  async function saveSupport(){

    if(!proStore){
      setStatus(
        'Loja não carregada.',
        'error'
      );
      return;
    }

    const get =
      id =>
        document
          .getElementById(id)
          ?.value
          ?.trim() || '';

    const chatEnabled =
      document
        .getElementById(
          'supportChatEnabled'
        )
        ?.checked !== false;

    const payload = {
      phone:
        get('supportPhone'),

      supportConfig: {
        greeting:
          get('supportGreeting'),

        purchaseMessage:
          get(
            'supportPurchaseMessage'
          ),

        address:
          get('supportAddress'),

        hours:
          get('supportHours'),

        chatTitle:
          get('supportChatTitle'),

        chatEnabled,

        quickReplies:
          quickReplies
            .map(item => ({
              question:
                String(
                  item.question || ''
                ).trim(),

              answer:
                String(
                  item.answer || ''
                ).trim()
            }))
            .filter(item =>
              item.question &&
              item.answer
            )
      }
    };

    setStatus(
      'Salvando...'
    );

    try{

      const resp =
        await fetch(
          '/api/public/store-branding',
          {
            method:'PUT',

            headers:{
              'Content-Type':
                'application/json'
            },

            credentials:'include',

            body:
              JSON.stringify(payload)
          }
        );

      const data =
        await resp
          .json()
          .catch(() => ({}));

      if(!resp.ok){
        throw new Error(
          data.error ||
          'Não foi possível salvar.'
        );
      }

      proStore =
        data.store ||
        proStore;

      renderStoreInfo(
        proStore
      );

      fillForm(
        proStore
      );

      localStorage.setItem(
        'lojaAtivaConfig',
        JSON.stringify({
          name:
            proStore.name || '',

          sub:
            proStore.sub || '',

          logo:
            proStore.logo || '',

          slug:
            proStore.slug || '',

          color:
            proStore.color || '',

          phone:
            proStore.phone || '',

          supportConfig:
            proStore.supportConfig || {}
        })
      );

      setStatus(
        'Configurações salvas com sucesso.',
        'ok'
      );

    }catch(error){

      console.error(error);

      setStatus(
        error.message ||
        'Erro ao salvar.',
        'error'
      );

    }

  }


  function copyPublicLink(){

    const input =
      document.getElementById(
        'adminPublicLink'
      );

    if(!input) return;

    const value =
      input.value;

    if(
      navigator.clipboard &&
      window.isSecureContext
    ){

      navigator.clipboard
        .writeText(value)
        .then(() =>
          setStatus(
            'Link público copiado.',
            'ok'
          )
        );

      return;
    }

    input.select();
    document.execCommand('copy');

    setStatus(
      'Link público copiado.',
      'ok'
    );

  }



  function customerStatus(
    text,
    type = ''
  ){
    const el =
      document.getElementById(
        'adminCustomerStatus'
      );

    if(!el) return;

    el.textContent = text || '';
    el.className =
      'admin-customer-status ' +
      (type || '');
  }


  function setAdminCustomerFormOpen(open){

    const area =
      document.getElementById(
        'adminCustomerFormArea'
      );

    if(!area) return;

    area.style.display =
      open
        ? 'block'
        : 'none';
  }


  function closeAdminCustomerForm(){

    clearAdminCustomerForm();

    setAdminCustomerFormOpen(false);
  }


  function openNewAdminCustomer(){

    clearAdminCustomerForm();

    const search =
      document.getElementById(
        'adminCustomerSearch'
      );

    if(search){
      search.value = '';
    }

    const results =
      document.getElementById(
        'adminCustomerSearchResults'
      );

    if(results){
      results.style.display = 'none';
    }

    setAdminCustomerFormOpen(true);

    customerStatus(
      'Novo cadastro.'
    );

    setTimeout(
      () => {
        document.getElementById(
          'adminCustomerName'
        )?.focus();
      },
      0
    );
  }


  function clearAdminCustomerForm(){

    const id =
      document.getElementById(
        'adminCustomerId'
      );

    const name =
      document.getElementById(
        'adminCustomerName'
      );

    const phone =
      document.getElementById(
        'adminCustomerPhone'
      );

    const notes =
      document.getElementById(
        'adminCustomerNotes'
      );

    const save =
      document.getElementById(
        'adminSaveCustomer'
      );

    if(id) id.value = '';
    if(name) name.value = '';
    if(phone) phone.value = '';
    if(notes) notes.value = '';

    if(save){
      save.textContent =
        'Salvar cliente';
    }
  }


  function customerPhoneDigits(value){
    return String(
      value || ''
    ).replace(/\D+/g,'');
  }


  function editAdminCustomer(id){

    const customer =
      adminCustomersCache.find(
        item =>
          String(item.id) ===
          String(id)
      );

    if(!customer) return;

    const search =
      document.getElementById(
        'adminCustomerSearch'
      );

    if(search){
      search.value = '';
    }

    const results =
      document.getElementById(
        'adminCustomerSearchResults'
      );

    if(results){
      results.style.display = 'none';
    }

    setAdminCustomerFormOpen(true);

    document.getElementById(
      'adminCustomerId'
    ).value =
      customer.id || '';

    document.getElementById(
      'adminCustomerName'
    ).value =
      customer.nome || '';

    document.getElementById(
      'adminCustomerPhone'
    ).value =
      customer.telefone || '';

    document.getElementById(
      'adminCustomerNotes'
    ).value =
      customer.obs || '';

    const save =
      document.getElementById(
        'adminSaveCustomer'
      );

    if(save){
      save.textContent =
        'Atualizar cliente';
    }

    customerStatus(
      'Cliente selecionado para edicao.'
    );

    document.getElementById(
      'adminCustomerName'
    )?.focus();
  }

  function openAdminCustomerWhatsApp(
    customer
  ){

    const phone =
      customerPhoneDigits(
        customer &&
        customer.telefone
      );

    if(!phone){
      customerStatus(
        'Este cliente nao possui telefone.',
        'error'
      );
      return;
    }

    const storeName =
      proStore &&
      proStore.name
        ? proStore.name
        : 'Nossa loja';

    const text =
      encodeURIComponent(
        'Ola ' +
        (
          customer.nome ||
          ''
        ) +
        '! Aqui e da ' +
        storeName +
        '.'
      );

    window.open(
      'https://wa.me/' +
      phone +
      '?text=' +
      text,
      '_blank'
    );
  }


  async function removeAdminCustomer(
    id
  ){

    const customer =
      adminCustomersCache.find(
        item =>
          String(item.id) ===
          String(id)
      );

    if(!customer) return;

    const ok =
      confirm(
        'Excluir o cliente "' +
        (
          customer.nome ||
          'Cliente'
        ) +
        '" desta loja?'
      );

    if(!ok) return;

    try{

      if(
        !window.Estoque ||
        typeof window.Estoque
          .removeCustomer !==
          'function'
      ){
        throw new Error(
          'Modulo de clientes indisponivel.'
        );
      }

      await window.Estoque
        .removeCustomer(id);

      clearAdminCustomerForm();

      await refreshAdminCustomers();

      customerStatus(
        'Cliente excluido.',
        'ok'
      );

    }catch(error){

      console.error(error);

      customerStatus(
        error.message ||
        'Erro ao excluir cliente.',
        'error'
      );
    }
  }


  function renderAdminCustomers(){

    const list =
      document.getElementById(
        'adminCustomersList'
      );

    const count =
      document.getElementById(
        'adminCustomersCount'
      );

    const results =
      document.getElementById(
        'adminCustomerSearchResults'
      );

    const search =
      String(
        document.getElementById(
          'adminCustomerSearch'
        )?.value || ''
      )
      .trim()
      .toLowerCase();

    if(!list) return;

    if(count){
      count.textContent =
        adminCustomersCache.length +
        (
          adminCustomersCache.length === 1
            ? ' cliente'
            : ' clientes'
        );
    }

    list.innerHTML = '';

    if(!search){

      if(results){
        results.style.display = 'none';
      }

      return;
    }

    const filtered =
      adminCustomersCache.filter(
        customer => {

          const haystack =
            (
              String(
                customer.nome || ''
              ) +
              ' ' +
              String(
                customer.telefone || ''
              ) +
              ' ' +
              String(
                customer.obs || ''
              )
            ).toLowerCase();

          return haystack.includes(
            search
          );
        }
      );

    if(results){
      results.style.display = 'block';
    }

    if(count){
      count.textContent =
        adminCustomersCache.length +
        (
          adminCustomersCache.length === 1
            ? ' cliente'
            : ' clientes'
        ) +
        ' - ' +
        filtered.length +
        ' encontrado(s)';
    }

    if(!filtered.length){

      const empty =
        document.createElement(
          'div'
        );

      empty.className =
        'admin-customers-empty';

      empty.textContent =
        'Nenhum cliente encontrado.';

      list.appendChild(empty);

      return;
    }

    filtered.forEach(
      customer => {

        const card =
          document.createElement(
            'article'
          );

        card.className =
          'admin-customer-card';

        const info =
          document.createElement(
            'div'
          );

        info.className =
          'admin-customer-info';

        const name =
          document.createElement(
            'strong'
          );

        name.textContent =
          customer.nome || 'Cliente';

        const phone =
          document.createElement(
            'span'
          );

        phone.textContent =
          customer.telefone
            ? 'WhatsApp: ' +
              customer.telefone
            : 'Sem telefone';

        const notes =
          document.createElement(
            'small'
          );

        notes.textContent =
          customer.obs ||
          'Sem observacoes';

        info.appendChild(name);
        info.appendChild(phone);
        info.appendChild(notes);

        const actions =
          document.createElement(
            'div'
          );

        actions.className =
          'admin-customer-actions';

        const whatsapp =
          document.createElement(
            'button'
          );

        whatsapp.type = 'button';
        whatsapp.className =
          'admin-pro-secondary';
        whatsapp.textContent =
          'WhatsApp';

        whatsapp.disabled =
          !customerPhoneDigits(
            customer.telefone
          );

        whatsapp.addEventListener(
          'click',
          () =>
            openAdminCustomerWhatsApp(
              customer
            )
        );

        const edit =
          document.createElement(
            'button'
          );

        edit.type = 'button';
        edit.className =
          'admin-pro-secondary';
        edit.textContent =
          'Editar';

        edit.addEventListener(
          'click',
          () =>
            editAdminCustomer(
              customer.id
            )
        );

        const remove =
          document.createElement(
            'button'
          );

        remove.type = 'button';
        remove.className =
          'admin-pro-danger';
        remove.textContent =
          'Excluir';

        remove.addEventListener(
          'click',
          () =>
            removeAdminCustomer(
              customer.id
            )
        );

        actions.appendChild(
          whatsapp
        );

        actions.appendChild(
          edit
        );

        actions.appendChild(
          remove
        );

        card.appendChild(info);
        card.appendChild(actions);

        list.appendChild(card);
      }
    );
  }

  async function refreshAdminCustomers(){

    try{

      if(
        !window.Estoque ||
        typeof window.Estoque
          .customers !==
          'function'
      ){
        throw new Error(
          'Modulo de clientes indisponivel.'
        );
      }

      const customers =
        await window.Estoque
          .customers();

      adminCustomersCache =
        Array.isArray(customers)
          ? customers
          : [];

      renderAdminCustomers();

    }catch(error){

      console.error(error);

      adminCustomersCache = [];

      renderAdminCustomers();

      customerStatus(
        error.message ||
        'Erro ao carregar clientes.',
        'error'
      );
    }
  }


  async function saveAdminCustomer(){

    const id =
      document.getElementById(
        'adminCustomerId'
      )?.value || '';

    const name =
      document.getElementById(
        'adminCustomerName'
      )?.value.trim() || '';

    const phone =
      document.getElementById(
        'adminCustomerPhone'
      )?.value.trim() || '';

    const notes =
      document.getElementById(
        'adminCustomerNotes'
      )?.value.trim() || '';

    if(!name){

      customerStatus(
        'Informe o nome do cliente.',
        'error'
      );

      document.getElementById(
        'adminCustomerName'
      )?.focus();

      return;
    }

    try{

      if(
        !window.Estoque ||
        typeof window.Estoque
          .saveCustomer !==
          'function'
      ){
        throw new Error(
          'Modulo de clientes indisponivel.'
        );
      }

      await window.Estoque
        .saveCustomer({
          id,
          nome:name,
          telefone:phone,
          obs:notes
        });

      closeAdminCustomerForm();

      const search =
        document.getElementById(
          'adminCustomerSearch'
        );

      if(search){
        search.value = '';
      }

      await refreshAdminCustomers();

      customerStatus(
        id
          ? 'Cliente atualizado com sucesso.'
          : 'Cliente cadastrado com sucesso.',
        'ok'
      );

    }catch(error){

      console.error(error);

      customerStatus(
        error.message ||
        'Erro ao salvar cliente.',
        'error'
      );
    }
  }

  function bindCustomersModule(){

    document
      .getElementById(
        'adminCustomerSearch'
      )
      ?.addEventListener(
        'input',
        renderAdminCustomers
      );

    document
      .getElementById(
        'adminNewCustomer'
      )
      ?.addEventListener(
        'click',
        openNewAdminCustomer
      );

    document
      .getElementById(
        'adminSaveCustomer'
      )
      ?.addEventListener(
        'click',
        saveAdminCustomer
      );

    document
      .getElementById(
        'adminClearCustomer'
      )
      ?.addEventListener(
        'click',
        () => {

          closeAdminCustomerForm();

          customerStatus('');
        }
      );

    closeAdminCustomerForm();

    renderAdminCustomers();
  }

  function testPublicStore(){

    if(!proStore) return;

    window.open(
      publicStoreLink(proStore),
      '_blank'
    );

  }


  function testWhatsApp(){

    if(!proStore) return;

    const phone =
      String(
        document
          .getElementById(
            'supportPhone'
          )
          ?.value || ''
      )
      .replace(/\D+/g,'');

    const greeting =
      document
        .getElementById(
          'supportGreeting'
        )
        ?.value
        ?.trim() ||
      DEFAULT_SUPPORT.greeting;

    const text =
      encodeURIComponent(
        greeting +
        '\n\n' +
        publicStoreLink(
          proStore
        )
      );

    const url =
      phone
        ? `https://wa.me/${phone}?text=${text}`
        : `https://wa.me/?text=${text}`;

    window.open(
      url,
      '_blank'
    );

  }


  function mount(){

    const main =
      document.querySelector(
        '.main-area'
      );

    if(!main) return;

    if(
      document.getElementById(
        'adminProHome'
      )
    ) return;

    const topbar =
      main.querySelector(
        '.topbar'
      );

    if(!topbar) return;

    document.body
      .classList.add(
        'store-admin-pro'
      );

    const home =
      document.createElement(
        'section'
      );

    home.id =
      'adminProHome';

    home.innerHTML = `
      <div class="admin-pro-home">

        <div class="admin-pro-hero">

          <div class="admin-pro-hero-copy">
            <h2 id="adminHeroName">
              Sua Loja
            </h2>

            <p>
              Central administrativa da loja
            </p>
          </div>

          <div class="admin-pro-badge">
            ●
            <span id="adminStoreStatus">
              Ativa
            </span>
          </div>

        </div>

        <div class="admin-pro-grid">

          <div class="admin-pro-stat">
            <span>Slug da loja</span>
            <strong id="adminStoreSlug">
              —
            </strong>
          </div>

          <div class="admin-pro-stat">
            <span>Licença</span>
            <strong id="adminStoreLicense">
              —
            </strong>
          </div>

          <div class="admin-pro-stat">
            <span>Vencimento</span>
            <strong id="adminStoreExpiry">
              —
            </strong>
          </div>

          <div class="admin-pro-stat">
            <span>Atendimento</span>
            <strong>
              WhatsApp + Chat
            </strong>
          </div>

        </div>

      </div>


      <section class="admin-pro-section">

        <div class="admin-pro-section-head">
          <h2>
            Link público da loja
          </h2>

          <p>
            Endereço enviado ao comprador para acessar
            a vitrine e escolher os looks.
          </p>
        </div>

        <div class="admin-pro-form">

          <div class="admin-field full">
            <label>
              Link da vitrine
            </label>

            <input
              id="adminPublicLink"
              type="text"
              readonly>
          </div>

          <div class="admin-pro-actions">
            <button
              id="copyAdminPublicLink"
              class="admin-pro-secondary"
              type="button">
              Copiar link
            </button>

            <button
              id="testAdminPublicLink"
              class="admin-pro-secondary"
              type="button">
              Testar como cliente
            </button>

            <button
              id="testAdminWhatsApp"
              class="admin-pro-secondary"
              type="button">
              Enviar pelo WhatsApp
            </button>
          </div>

        </div>

      </section>



      <section
        class="admin-pro-section admin-customers-section"
        id="adminCustomersSection"
      >

        <div class="admin-pro-section-head">
          <h2>
            &#128101; Clientes da Loja
          </h2>

          <p>
            Localize rapidamente um cliente por nome ou telefone.
            A lista completa nao fica exposta no painel.
          </p>
        </div>

        <div class="admin-pro-form">

          <div class="admin-customers-summary">
            <div>
              <span>Clientes cadastrados</span>
              <strong id="adminCustomersCount">0 clientes</strong>
            </div>

            <button
              id="adminNewCustomer"
              class="admin-pro-primary"
              type="button"
            >
              + Novo cliente
            </button>
          </div>

          <div class="admin-field full">
            <label for="adminCustomerSearch">
              Buscar cliente
            </label>

            <input
              id="adminCustomerSearch"
              type="search"
              maxlength="120"
              placeholder="Digite nome ou telefone"
              autocomplete="off"
            >
          </div>

          <div
            id="adminCustomerSearchResults"
            class="admin-customers-search-results"
          >
            <div
              id="adminCustomersList"
              class="admin-customers-list"
            ></div>
          </div>

          <div
            id="adminCustomerFormArea"
            class="admin-customer-form-area hidden"
          >

            <input
              id="adminCustomerId"
              type="hidden"
            >

            <div class="admin-pro-form">

              <div class="admin-field">
                <label for="adminCustomerName">
                  Nome do cliente
                </label>

                <input
                  id="adminCustomerName"
                  type="text"
                  maxlength="120"
                  placeholder="Ex.: Maria Silva"
                  autocomplete="name"
                >
              </div>

              <div class="admin-field">
                <label for="adminCustomerPhone">
                  WhatsApp / telefone
                </label>

                <input
                  id="adminCustomerPhone"
                  type="tel"
                  maxlength="30"
                  placeholder="Ex.: 31999999999"
                  autocomplete="tel"
                >
              </div>

              <div class="admin-field full">
                <label for="adminCustomerNotes">
                  Observacoes
                </label>

                <textarea
                  id="adminCustomerNotes"
                  maxlength="1000"
                  placeholder="Ex.: Prefere looks sociais, tamanho M..."
                ></textarea>
              </div>

              <div class="admin-pro-actions">

                <button
                  id="adminSaveCustomer"
                  class="admin-pro-primary"
                  type="button"
                >
                  Salvar cliente
                </button>

                <button
                  id="adminClearCustomer"
                  class="admin-pro-secondary"
                  type="button"
                >
                  Cancelar
                </button>

              </div>

            </div>

          </div>

          <div class="admin-customers-toolbar">
            <span id="adminCustomerStatus"></span>
          </div>

        </div>

      </section>


<section
        class="admin-pro-section admin-support-section"
        id="adminSupportSection">

        <div class="admin-pro-section-head">
          <h2>Atendimento & WhatsApp</h2>

          <p>
            Configuracoes exclusivas desta loja para
            WhatsApp, chat e atendimento ao comprador.
          </p>
        </div>

        <div class="admin-support-summary">

          <div class="admin-support-summary-info">
            <span>Atendimento da loja</span>

            <strong id="adminSupportSummaryTitle">
              Configuracoes carregadas
            </strong>

            <small id="adminSupportSummaryText">
              WhatsApp, chat e mensagens da loja.
            </small>
          </div>

          <button
            id="editSupportConfig"
            class="admin-pro-primary"
            type="button">
            Editar configuracoes
          </button>

        </div>

        <div
          id="supportConfigFormArea"
          class="admin-support-form-area"
          style="display:none">

          <div class="admin-pro-form">

            <div class="admin-field">
              <label>Numero do WhatsApp</label>

              <input
                id="supportPhone"
                type="tel"
                maxlength="30"
                placeholder="Ex.: 5531999999999">

              <small class="admin-help">
                Informe pais + DDD + numero.
              </small>
            </div>

            <div class="admin-field">
              <label>Titulo do chat</label>

              <input
                id="supportChatTitle"
                maxlength="100"
                placeholder="Atendimento da Loja">
            </div>

            <div class="admin-field full">
              <label>Saudacao</label>

              <textarea
                id="supportGreeting"
                maxlength="1000"
                placeholder="Mensagem de boas-vindas"></textarea>
            </div>

            <div class="admin-field full">
              <label>Mensagem de compra</label>

              <textarea
                id="supportPurchaseMessage"
                maxlength="1000"
                placeholder="Mensagem usada quando o cliente demonstra interesse em um look"></textarea>
            </div>

            <div class="admin-field">
              <label>Endereco</label>

              <textarea
                id="supportAddress"
                maxlength="1000"
                placeholder="Endereco da loja"></textarea>
            </div>

            <div class="admin-field">
              <label>Horario de atendimento</label>

              <textarea
                id="supportHours"
                maxlength="1000"
                placeholder="Ex.: Segunda a sabado, 9h as 18h"></textarea>
            </div>

            <div class="admin-field full">
              <label>
                <input
                  id="supportChatEnabled"
                  type="checkbox"
                  checked>
                Ativar assistente/chat desta loja
              </label>
            </div>

            <div class="quick-replies-editor">

              <div class="admin-field full">
                <label>Respostas rapidas</label>

                <small class="admin-help">
                  Cada loja pode cadastrar ate
                  12 perguntas e respostas.
                </small>
              </div>

              <div id="quickRepliesEditor"></div>

              <button
                id="addQuickReply"
                class="admin-pro-secondary"
                type="button">
                + Adicionar resposta
              </button>

            </div>

            <div class="admin-pro-actions">

              <button
                id="saveStoreSupport"
                class="admin-pro-primary"
                type="button">
                Salvar atendimento
              </button>

              <button
                id="previewStoreWhatsApp"
                class="admin-pro-secondary"
                type="button">
                Testar WhatsApp
              </button>

              <button
                id="cancelSupportConfig"
                class="admin-pro-secondary"
                type="button">
                Cancelar
              </button>

            </div>

            <div
              id="adminSaveStatus"
              class="admin-save-status">
            </div>

          </div>

        </div>

      </section>
    `;

    topbar.insertAdjacentElement(
      'afterend',
      home
    );

    createOverviewButton();
    bindExistingMenu();

    document
      .getElementById(
        'addQuickReply'
      )
      ?.addEventListener(
        'click',
        addQuickReply
      );

    document
      .getElementById(
        'editSupportConfig'
      )
      ?.addEventListener(
        'click',
        openSupportConfig
      );

    document
      .getElementById(
        'cancelSupportConfig'
      )
      ?.addEventListener(
        'click',
        closeSupportConfig
      );

    document
      .getElementById(
        'saveStoreSupport'
      )
      ?.addEventListener(
        'click',
        saveSupport
      );

    document
      .getElementById(
        'copyAdminPublicLink'
      )
      ?.addEventListener(
        'click',
        copyPublicLink
      );

    document
      .getElementById(
        'testAdminPublicLink'
      )
      ?.addEventListener(
        'click',
        testPublicStore
      );

    document
      .getElementById(
        'testAdminWhatsApp'
      )
      ?.addEventListener(
        'click',
        testWhatsApp
      );

    document
      .getElementById(
        'previewStoreWhatsApp'
      )
      ?.addEventListener(
        'click',
        testWhatsApp
      );

    bindCustomersModule();

    showOverview();

  }


  async function loadStore(){

    const slug =
      slugAtual();

    if(!slug){
      setStatus(
        'Loja não identificada.',
        'error'
      );
      return;
    }

    try{

      const resp =
        await fetch(
          '/api/public/session-store',
          {
            cache:'no-store',
            credentials:'include'
          }
        );

      const data =
        await resp.json();

      if(
        !resp.ok ||
        !data.store
      ){
        throw new Error(
          data.error ||
          'Loja não encontrada.'
        );
      }

      proStore =
        data.store;

      if(proStore && proStore.slug){
        localStorage.setItem(
          'loja_slug',
          proStore.slug
        );
      }

      await refreshAdminCustomers();

      renderStoreInfo(
        proStore
      );

      fillForm(
        proStore
      );

    }catch(error){

      console.error(error);

      setStatus(
        error.message ||
        'Erro ao carregar loja.',
        'error'
      );

    }

  }


  function init(){

    mount();
    loadStore();

  }


  if(
    document.readyState ===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  }else{
    init();
  }

})();
/* PRODUCER BACK BUTTON */
(function(){

  async function mostrarVoltarPainelMestre(){

    try{

      const resp = await fetch(
        '/api/admin/session',
        {
          credentials:'include',
          cache:'no-store'
        }
      );

      if(!resp.ok) return;

      const data = await resp.json();

      if(!data?.ok) return;

      const hero =
        document.querySelector(
          '.admin-pro-hero'
        );

      if(!hero) return;

      if(
        document.getElementById(
          'backToMasterBtn'
        )
      ) return;

      const btn =
        document.createElement(
          'button'
        );

      btn.id =
        'backToMasterBtn';

      btn.type =
        'button';

      btn.className =
        'admin-pro-secondary';

      btn.textContent =
        '← Voltar ao Painel Mestre';

      btn.addEventListener(
        'click',
        function(){
          location.href =
            '/index.html?view=lojas_master.html';
        }
      );

      hero.appendChild(btn);

    }catch(e){
      console.log(
        'Sessão de produtor não detectada.'
      );
    }

  }

  if(
    document.readyState ===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      function(){
        setTimeout(
          mostrarVoltarPainelMestre,
          50
        );
      }
    );
  }else{
    setTimeout(
      mostrarVoltarPainelMestre,
      50
    );
  }

})();
