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
