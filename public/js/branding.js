(function(){

  const DEFAULTS = {
    name: 'Loja Mestre',
    sub: 'Central de administracao do produtor',
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

    const brandKicker =
      document.getElementById(
        'brandKicker'
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

    if(brandKicker){
      brandKicker.textContent =
        store ? 'LOJA SELECIONADA' : 'PAINEL MESTRE • PRODUTOR';
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
    let sessionResolved = false;


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

        sessionResolved = true;

        const data =
          await res.json();

        store =
          data.activeStore ||
          null;

      }

    }catch(e){}


    if(
      !sessionResolved &&
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


    if(!sessionResolved && !store){

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

    if(sessionResolved && !store){
      try{
        localStorage.removeItem("loja_slug");
        localStorage.removeItem("lojaAtivaConfig");
      }catch(e){}
    }

    return store;

  }


  window.ProvadorBranding = {
    aplicarLoja,
    carregarLojaAtiva
  };


  carregarLojaAtiva();

})();
