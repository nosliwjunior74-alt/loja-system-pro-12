(function(){

  const DEFAULTS = {
    name: 'Sua Loja',
    sub: 'Dashboard Integrado Multi-Loja',
    logo: 'assets/default-logo.svg',
    color: '#e33d8f'
  };

  function normalizarLoja(store){

    if(!store){
      return { ...DEFAULTS };
    }

    return {
      name: store.name || DEFAULTS.name,
      sub:
        store.sub ||
        store.subtitle ||
        DEFAULTS.sub,
      logo:
        store.logo ||
        DEFAULTS.logo,
      color:
        store.color ||
        DEFAULTS.color,
      slug:
        store.slug ||
        '',
      id:
        store.id ||
        ''
    };

  }


  function aplicarLoja(store){

    const cfg =
      normalizarLoja(store);

    const brandName =
      document.getElementById(
        'brandName'
      );

    const brandSub =
      document.getElementById(
        'brandSub'
      );

    const brandLogo =
      document.getElementById(
        'brandLogo'
      );

    const topbarSub =
      document.getElementById(
        'topbarSub'
      );

    const activeStoreName =
      document.getElementById(
        'activeStoreName'
      );


    if(brandName){
      brandName.textContent =
        cfg.name;
    }

    if(brandSub){
      brandSub.textContent =
        cfg.sub;
    }

    if(topbarSub){
      topbarSub.textContent =
        cfg.sub;
    }

    if(activeStoreName){
      activeStoreName.textContent =
        cfg.name;
    }

    if(brandLogo){
      brandLogo.src =
        cfg.logo;
    }

    if(cfg.color){
      document.documentElement
        .style
        .setProperty(
          '--pink-4',
          cfg.color
        );
    }


    if(cfg.slug){

      localStorage.setItem(
        'loja_slug',
        cfg.slug
      );

    }


    try{

      localStorage.setItem(
        'lojaAtivaConfig',
        JSON.stringify(store)
      );

    }catch(e){}


    return cfg;

  }


  async function carregarLojaAtiva(){

    let store = null;


    try{

      const res =
        await fetch(
          '/api/admin/session',
          {
            credentials:
              'same-origin',
            cache:
              'no-store'
          }
        );


      if(res.ok){

        const data =
          await res.json();

        store =
          data.activeStore ||
          null;

      }

    }catch(e){}


    if(
      !store &&
      window.LocalStorageManager
    ){

      try{

        store =
          typeof LocalStorageManager
            .getActive === 'function'
            ? LocalStorageManager
                .getActive()
            : null;

      }catch(e){}

    }


    if(!store){

      try{

        const saved =
          localStorage.getItem(
            'lojaAtivaConfig'
          );

        if(saved){
          store =
            JSON.parse(saved);
        }

      }catch(e){}

    }


    aplicarLoja(store);

    return store;

  }


  window.ProvadorBranding = {
    aplicarLoja,
    carregarLojaAtiva
  };


  carregarLojaAtiva();

})();
