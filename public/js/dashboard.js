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

    btn.classList.toggle(
      'active',
      btnUrl === target
    );

  });

}


function tituloDoBotao(btn){

  return btn
    .textContent
    .replace(/\s+/g, ' ')
    .trim();

}


function abrirTela(url, btn){

  if(!url || !frame){
    return;
  }

  activateButtonForUrl(url);

  frame.src =
    url;

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
        btn.dataset.url,
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
