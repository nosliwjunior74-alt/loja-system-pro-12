const buttons =
  Array.from(
    document.querySelectorAll('.menu-btn')
  );

const frame =
  document.getElementById('appFrame');

const title =
  document.getElementById('currentTitle');

const topbarSub =
  document.getElementById('topbarSub');


function normalizarUrl(url){

  return String(url || '')
    .split('?')[0]
    .split('#')[0];

}


function activateButtonForUrl(url){

  const target =
    normalizarUrl(url);

  buttons.forEach(function(btn){

    const btnUrl =
      normalizarUrl(
        btn.dataset.url
      );

    const isContextualAi =
      btn?.dataset?.aiMarketingContextual === 'true';

    const aiMatches =
      isContextualAi &&
      (
        target === 'display_pro/produtor.html' ||
        target === 'display_pro/loja.html'
      );

    btn.classList.toggle(
      'active',
      aiMatches || btnUrl === target
    );

  });

}


function tituloDoBotao(btn){

  return btn
    .textContent
    .replace(/\s+/g, ' ')
    .trim();

}


function currentFrameUrl(){

  return normalizarUrl(
    frame?.getAttribute('src') ||
    frame?.src ||
    ''
  );

}

function isStoreWorkspaceUrl(url){

  return [
    'provador/index.html',
    'provador/admin.html',
    'configuracoes.html',
    'remover_fundo/index.html',
    'display_pro/loja.html'
  ].includes(
    normalizarUrl(url)
  );

}

function resolverUrlDoBotao(btn){

  if(
    btn?.dataset?.aiMarketingContextual === 'true'
  ){

    return isStoreWorkspaceUrl(
      currentFrameUrl()
    )
      ? 'display_pro/loja.html'
      : 'display_pro/produtor.html';

  }

  return btn?.dataset?.url || '';

}

function abrirTela(url, btn){

  if(!url || !frame){
    return;
  }

  activateButtonForUrl(url);

  document.body.classList.toggle(
    'provador-frame-open',
    normalizarUrl(url) === 'provador/provador.html'
  );

  const separator = String(url).includes('?') ? '&' : '?';

  frame.src =
    url + separator + '_v=' + Date.now();

  if(title && btn){

    title.textContent =
      tituloDoBotao(btn);

  }

}


buttons.forEach(function(btn){

  btn.addEventListener(
    'click',
    function(){

      abrirTela(
        resolverUrlDoBotao(btn),
        btn
      );

    }
  );

});


/* INITIAL VIEW PRO */
(function(){

  const view =
    new URLSearchParams(
      location.search
    ).get('view');

  if(!view) return;

  const target =
    normalizarUrl(view);

  const btn =
    buttons.find(function(item){

      return normalizarUrl(
        item.dataset.url
      ) === target;

    });

  /*
    Segurança:
    só abre telas que já existem
    oficialmente no menu do Dashboard.
  */
  if(!btn) return;

  abrirTela(
    btn.dataset.url,
    btn
  );

})();


async function atualizarLojaAtiva(store){

  if(
    window.ProvadorBranding &&
    typeof window
      .ProvadorBranding
      .aplicarLoja === 'function' &&
    store
  ){

    window
      .ProvadorBranding
      .aplicarLoja(store);

    return;
  }


  if(
    window.ProvadorBranding &&
    typeof window
      .ProvadorBranding
      .carregarLojaAtiva === 'function'
  ){

    await window
      .ProvadorBranding
      .carregarLojaAtiva();

  }

}


window.addEventListener(
  'message',
  async function(ev){

    const data =
      ev && ev.data
        ? ev.data
        : {};


    if(
      data.type === 'set-title' &&
      data.title &&
      title
    ){

      title.textContent =
        data.title;

    }


    if(
      data.type === 'set-subtitle' &&
      data.subtitle &&
      topbarSub
    ){

      topbarSub.textContent =
        data.subtitle;

    }


    if(
      data.type === 'store-selected' ||
      data.type === 'active-store-changed'
    ){

      await atualizarLojaAtiva(
        data.store || null
      );

    }


    if(
      data.type === 'branding-updated'
    ){

      await atualizarLojaAtiva(
        data.store || null
      );

      if(
        data.reloadFrame === true &&
        frame &&
        frame.contentWindow
      ){

        try{

          frame
            .contentWindow
            .location
            .reload();

        }catch(e){}

      }

    }


    if(
      data.type === 'open-url' &&
      data.url
    ){

      const target =
        normalizarUrl(
          data.url
        );

      const btn =
        buttons.find(function(item){

          return normalizarUrl(
            item.dataset.url
          ) === target;

        });


      abrirTela(
        data.url,
        btn || null
      );

    }

  }
);


const logoutBtn =
  document.getElementById(
    'logoutAdminBtn'
  );


if(logoutBtn){

  logoutBtn.addEventListener(
    'click',
    async function(){

      try{

        await fetch(
          '/api/admin/logout',
          {
            method:'POST',
            credentials:'same-origin'
          }
        );

        location.href =
          '/admin-login.html';

      }catch(e){

        alert(
          'Modo local: não há sessão online para encerrar.'
        );

      }

    }
  );

}

/* MOBILE DRAWER PRO */
(function(){

  const mobileBtn =
    document.getElementById('mobileMenuBtn');

  const mobileOverlay =
    document.getElementById('mobileMenuOverlay');

  const mobileSidebar =
    document.querySelector('.sidebar');


  function isMobile(){
    return window.matchMedia(
      '(max-width: 760px)'
    ).matches;
  }


  function openMobileMenu(){

    if(!isMobile()) return;

    document.body.classList.add(
      'mobile-menu-open'
    );

    if(mobileBtn){
      mobileBtn.setAttribute(
        'aria-expanded',
        'true'
      );
    }

  }


  function closeMobileMenu(){

    document.body.classList.remove(
      'mobile-menu-open'
    );

    if(mobileBtn){
      mobileBtn.setAttribute(
        'aria-expanded',
        'false'
      );
    }

  }


  function toggleMobileMenu(){

    if(
      document.body.classList.contains(
        'mobile-menu-open'
      )
    ){
      closeMobileMenu();
    }else{
      openMobileMenu();
    }

  }


  if(mobileBtn){

    mobileBtn.addEventListener(
      'click',
      function(e){

        e.preventDefault();
        e.stopPropagation();

        toggleMobileMenu();

      }
    );

  }


  if(mobileOverlay){

    mobileOverlay.addEventListener(
      'click',
      closeMobileMenu
    );

  }


  if(mobileSidebar){

    mobileSidebar.addEventListener(
      'click',
      function(e){

        const item =
          e.target.closest(
            '.menu-btn'
          );

        if(
          item &&
          isMobile()
        ){

          closeMobileMenu();

        }

      }
    );

  }


  document.addEventListener(
    'keydown',
    function(e){

      if(e.key === 'Escape'){
        closeMobileMenu();
      }

    }
  );


  window.addEventListener(
    'resize',
    function(){

      if(!isMobile()){
        closeMobileMenu();
      }

    }
  );

})();

/* SHELL PREMIUM / MENU RETRATIL / SPLASH / IDENTIDADE V1 */
(function(){
  const KEY_MENU='provador_shell_sidebar_collapsed_v1';
  const KEY_ID='provador_shell_identity_v1';
  const defaults={topName:'Provador Pro',topMessage:'Moda que vende mais',topLogo:'',sameLogo:true,bottomLogo:'',bottomName:'Provador Pro',bottomMessage:'Moda que vende mais'};

  function readIdentity(){
    try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY_ID)||'{}')||{});}
    catch(e){return Object.assign({},defaults);}
  }
  function postIdentity(cfg){try{frame?.contentWindow?.postMessage({type:'shell-identity',config:cfg},location.origin);}catch(e){}}
  function applyIdentity(cfg){
    cfg=Object.assign({},defaults,cfg||{});
    const n=document.getElementById('ppSplashName'),m=document.getElementById('ppSplashMessage'),img=document.getElementById('ppSplashLogoImg'),hanger=document.getElementById('ppSplashHanger');
    if(n)n.textContent=cfg.topName||defaults.topName;if(m)m.textContent=cfg.topMessage||defaults.topMessage;
    if(img&&hanger){if(cfg.topLogo){img.src=cfg.topLogo;img.hidden=false;img.style.display='block';hanger.style.display='none';}else{img.removeAttribute('src');img.hidden=true;img.style.display='none';hanger.style.display='block';}}
    postIdentity(cfg);
  }
  function fill(cfg){
    const pairs={ppIdentityTopName:'topName',ppIdentityTopMessage:'topMessage',ppIdentityTopLogo:'topLogo',ppIdentityBottomLogo:'bottomLogo',ppIdentityBottomName:'bottomName',ppIdentityBottomMessage:'bottomMessage'};
    Object.entries(pairs).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=cfg[key]||'';});
    const s=document.getElementById('ppIdentitySameLogo');if(s)s.checked=cfg.sameLogo!==false;
    const b=document.getElementById('ppIdentityBottomLogo');if(b)b.disabled=cfg.sameLogo!==false;
  }
  function form(){
    const v=id=>document.getElementById(id)?.value?.trim()||'';
    const same=document.getElementById('ppIdentitySameLogo')?.checked!==false;
    return {topName:v('ppIdentityTopName')||defaults.topName,topMessage:v('ppIdentityTopMessage')||defaults.topMessage,topLogo:v('ppIdentityTopLogo'),sameLogo:same,bottomLogo:same?v('ppIdentityTopLogo'):v('ppIdentityBottomLogo'),bottomName:v('ppIdentityBottomName')||defaults.bottomName,bottomMessage:v('ppIdentityBottomMessage')||defaults.bottomMessage};
  }
  function openIdentity(){const c=readIdentity();fill(c);document.getElementById('ppIdentityPanel')?.removeAttribute('hidden');document.getElementById('ppIdentityOverlay')?.removeAttribute('hidden');}
  function closeIdentity(){document.getElementById('ppIdentityPanel')?.setAttribute('hidden','');document.getElementById('ppIdentityOverlay')?.setAttribute('hidden','');}

  document.getElementById('ppIdentityBtn')?.addEventListener('click',openIdentity);
  document.getElementById('ppIdentityClose')?.addEventListener('click',closeIdentity);
  document.getElementById('ppIdentityOverlay')?.addEventListener('click',closeIdentity);
  document.getElementById('ppIdentitySameLogo')?.addEventListener('change',function(){const b=document.getElementById('ppIdentityBottomLogo');if(b)b.disabled=this.checked;});
  document.getElementById('ppIdentitySave')?.addEventListener('click',function(){const c=form();localStorage.setItem(KEY_ID,JSON.stringify(c));applyIdentity(c);closeIdentity();});
  document.getElementById('ppIdentityReset')?.addEventListener('click',function(){localStorage.removeItem(KEY_ID);fill(defaults);applyIdentity(defaults);});

  if(window.matchMedia('(min-width:761px)').matches){
    try{if(localStorage.getItem(KEY_MENU)==='1')document.body.classList.add('pp-sidebar-collapsed');}catch(e){}
  }
  const btn=document.getElementById('mobileMenuBtn');
  if(btn){
    btn.addEventListener('click',function(){
      if(window.matchMedia('(min-width:761px)').matches){
        document.body.classList.toggle('pp-sidebar-collapsed');
        try{localStorage.setItem(KEY_MENU,document.body.classList.contains('pp-sidebar-collapsed')?'1':'0');}catch(e){}
      }
    },true);
  }

  const splash=document.getElementById('ppShellSplash');
  const cfg=readIdentity();applyIdentity(cfg);
  frame?.addEventListener('load',()=>postIdentity(readIdentity()));

  function hideSplash(){if(!splash)return;splash.classList.add('pp-hide');setTimeout(()=>splash.remove(),450);}
  const seen=sessionStorage.getItem('provador_shell_splash_seen_v1')==='1';
  if(seen){setTimeout(hideSplash,150);}else{sessionStorage.setItem('provador_shell_splash_seen_v1','1');setTimeout(hideSplash,1050);}
})();


/* MENU PROFISSIONAL V1.8 */
(function(){
  const identitySide=document.getElementById('ppIdentityBtnSidebar');
  const identityTop=document.getElementById('ppIdentityBtn');
  if(identitySide && identityTop){
    identitySide.addEventListener('click',function(e){
      e.preventDefault();
      identityTop.click();
      if(window.matchMedia('(max-width:760px)').matches){
        document.getElementById('mobileMenuBtn')?.click();
      }
    });
  }

  document.querySelectorAll('.pp-footer-mini-btn[data-url]').forEach(function(btn){
    btn.addEventListener('click',function(){
      const url=btn.getAttribute('data-url');
      if(!url)return;
      const menuBtn=document.querySelector('.menu-btn[data-url="'+url+'"]');
      if(menuBtn){ menuBtn.click(); return; }
      const frame=document.getElementById('appFrame');
      if(frame) frame.src=url;
    });
  });
})();
