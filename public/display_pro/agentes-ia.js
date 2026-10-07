(() => {
  const qs = new URLSearchParams(location.search);
  const context = qs.get('context') === 'loja' ? 'loja' : 'produtor';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
  const safe = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const agents = [
    {id:'video-curto',name:'Vídeo Curto Viral',icon:'🎬',desc:'Planeja roteiros curtos com gancho, desenvolvimento e CTA para Reels, Shorts e TikTok.',tags:['video','conteudo','marketing','novo']},
    {id:'copy-legenda',name:'Copy de Legenda',icon:'📝',desc:'Estrutura legenda, CTA e hashtags para o conteúdo selecionado.',tags:['copywriting','conteudo','marketing']},
    {id:'ideias-virais',name:'Ideias Virais',icon:'💡',desc:'Organiza ideias de conteúdo alinhadas ao nicho, público e objetivo.',tags:['conteudo','copywriting','estrategia']},
    {id:'calendario',name:'Calendário de Conteúdo IA',icon:'🗓️',desc:'Planeja 7, 15 ou 30 dias de conteúdo e frequência de postagem.',tags:['conteudo','marketing','estrategia','novo']},
    {id:'top-canais',name:'Top Canais',icon:'🔗',desc:'Ajuda a priorizar redes e canais de divulgação conforme público e objetivo.',tags:['marketing','estrategia','trafego']},
    {id:'publico-alvo',name:'Mapeador de Público-Alvo',icon:'👥',desc:'Organiza perfil de público, interesses, contexto e intenção.',tags:['marketing','estrategia','vendas']},
    {id:'dores-desejos',name:'Dores e Desejos',icon:'💜',desc:'Mapeia dores, desejos e oportunidades de comunicação sem inventar características sensíveis.',tags:['marketing','copywriting','vendas']},
    {id:'radar',name:'Radar de Conteúdo',icon:'🤖',desc:'Central para registrar tendências, temas e formatos que merecem teste.',tags:['conteudo','marketing','estrategia']},
    {id:'post-imagem',name:'Post de Imagem Única',icon:'🖼️',desc:'Estrutura conceito visual, texto e CTA para um post único.',tags:['imagem','conteudo','marketing']},
    {id:'prompt-imagem',name:'Criador de Prompts de Imagem',icon:'🎨',desc:'Organiza prompts detalhados para futuras IAs de imagem.',tags:['imagem','conteudo']},
    {id:'img-scan',name:'IMG Scan',icon:'✨',desc:'Área preparada para descrever e analisar referências visuais.',tags:['imagem','conteudo','novo']},
    {id:'publicos-ads',name:'Gerador de Públicos para Anúncios',icon:'🛡️',desc:'Estrutura hipóteses de segmentação para Meta, Google e outros canais.',tags:['trafego','vendas','marketing']},
    {id:'anuncios',name:'Gerador de Anúncios',icon:'📣',desc:'Organiza variações de anúncios, oferta, CTA, público e canal.',tags:['trafego','vendas','copywriting','marketing','novo']},
    {id:'stories',name:'Stories Lucrativos',icon:'🏆',desc:'Monta sequência de Stories com começo, prova, oferta e CTA.',tags:['conteudo','copywriting','vendas']},
    {id:'raio-x',name:'Raio X de Cliente',icon:'🎯',desc:'Ajuda a organizar necessidades, produtos e oportunidades para cada perfil de cliente.',tags:['vendas','estrategia']},
    {id:'copy-pagina',name:'Copy de Página de Vendas',icon:'📄',desc:'Estrutura título, promessa, benefícios, objeções, prova e CTA.',tags:['vendas','copywriting','marketing']},
    {id:'vsl',name:'Agente VSL',icon:'📹',desc:'Estrutura roteiro de vídeo de vendas orientado à oferta.',tags:['video','vendas','copywriting']},
    {id:'ganchos',name:'Ganchos de Alto Impacto',icon:'⚓',desc:'Cria estrutura de aberturas fortes para prender atenção sem promessa enganosa.',tags:['conteudo','copywriting','video']},
    {id:'carrossel-resumo',name:'Carrossel Resumo',icon:'▣',desc:'Transforma um tema em sequência curta de cards.',tags:['conteudo','imagem']},
    {id:'carrossel-minidoc',name:'Carrossel Minidoc',icon:'🪄',desc:'Organiza conteúdo educativo em carrossel com narrativa.',tags:['conteudo','imagem','novo']},
    {id:'titulos',name:'Títulos de Alto Impacto',icon:'📣',desc:'Estrutura títulos fortes para posts, páginas e vídeos.',tags:['conteudo','copywriting']},
    {id:'youtube-seo',name:'YouTube SEO',icon:'▶️',desc:'Organiza título, descrição, palavras-chave e checklist de publicação.',tags:['youtube','conteudo','marketing']},
    {id:'roteirista-youtube',name:'Roteirista de YouTube',icon:'🎞️',desc:'Estrutura roteiros longos com abertura, blocos, CTA e fechamento.',tags:['youtube','video','copywriting']},
    {id:'thumbnail',name:'Thumbnail para YouTube',icon:'🌄',desc:'Planeja conceito de thumbnail, texto curto e foco visual.',tags:['youtube','imagem']},
    {id:'voz-marca',name:'Manual de Voz da Marca',icon:'📚',desc:'Registra tom, estilo, palavras preferidas e consistência da comunicação.',tags:['marca','marketing','copywriting','novo']},
    {id:'naming',name:'Naming',icon:'Aa',desc:'Área para nomes de campanhas, coleções, módulos, ofertas e projetos.',tags:['marca','marketing','novo']},
    {id:'identidade',name:'Identidade Visual',icon:'🖌️',desc:'Organiza referências, direção visual e consistência de marca.',tags:['marca','imagem','marketing']},
    {id:'divulga-produto',name:'Divulga Produto / Look',icon:'👗',desc:'Atalho para transformar produto, look ou coleção em uma estratégia de divulgação.',tags:['produto','vendas','conteudo','marketing','novo'],contexts:['loja']},
    {id:'campanha-local',name:'Campanha Local',icon:'📍',desc:'Planeja divulgação por cidade, região e intenção de compra.',tags:['trafego','vendas','marketing','estrategia'],contexts:['loja']},
    {id:'whatsapp',name:'WhatsApp de Divulgação',icon:'💬',desc:'Estrutura mensagens de novidade, oferta, recuperação e atendimento.',tags:['vendas','copywriting','marketing']},
    {id:'campanha-provador',name:'Campanha Provador Pro',icon:'🧩',desc:'Atalho do Produtor para divulgar planos, módulos, demonstrações e upgrades.',tags:['produto','vendas','marketing','trafego','novo'],contexts:['produtor']}
  ];

  const defaultProducer = {
    name:'Provador Pro System',
    niche:'Tecnologia para varejo de moda / provador virtual',
    audience:'Lojistas de moda e negócios que desejam modernizar atendimento e vendas',
    region:'Brasil',
    voice:'Profissional, clara e orientada a resultado',
    goal:'Vender planos, módulos, demonstrações e upgrades',
    networks:'Instagram, Facebook, TikTok, YouTube, Google e WhatsApp'
  };

  let store = null;
  let storeKey = context === 'produtor' ? 'producer' : 'store-unknown';
  let currentFilter = 'todos';
  let favorites = new Set();

  const profileKey = () => `amp:agents:v1:${storeKey}:profile`;
  const favKey = () => `amp:agents:v1:${storeKey}:favorites`;
  const scheduleKey = () => `amp:agents:v1:${storeKey}:schedule`;

  function loadJSON(key, fallback){
    try { const x = JSON.parse(localStorage.getItem(key)); return x ?? fallback; } catch(_) { return fallback; }
  }
  function saveJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }

  async function resolveContext(){
    $('#agentsContext').textContent = context === 'loja' ? 'LOJISTA' : 'PRODUTOR';
    $('#agentsContext').classList.add(context === 'loja' ? 'amp-context-store' : 'amp-context-producer');
    $('#agentsBack').href = context === 'loja' ? 'loja.html' : 'produtor.html';
    $('#agentsHelpLink').href = `ajuda.html?context=${context}#agentes-ia`;

    if(context === 'loja'){
      try{
        const r = await fetch('/api/session/store-config',{credentials:'same-origin'});
        const j = await r.json();
        if(j?.store){
          store = j.store;
          storeKey = 'store-' + (store.id || store.slug || 'selected');
        }
      }catch(_){}
    }
    favorites = new Set(loadJSON(favKey(), []));
    initProfile();
    renderAgents();
  }

  function baseProfile(){
    if(context === 'produtor') return {...defaultProducer};
    return {
      name: store?.name || 'Sua Loja',
      niche:store?.marketingProfile?.niche || '',
      audience:store?.marketingProfile?.audience || '',
      region:
        store?.marketingProfile?.region ||
        [store?.city,store?.state].filter(Boolean).join(' / '),
      voice:store?.marketingProfile?.voice || '',
      goal:store?.marketingProfile?.goal || 'Divulgar produtos e vender mais',
      networks:store?.marketingProfile?.networks || 'Instagram, Facebook, TikTok e WhatsApp'
    };
  }

  function initProfile(){
    const saved = loadJSON(profileKey(), {});
    const base = baseProfile();
    const backendHasProfile =
      context === 'loja' &&
      store?.marketingProfile &&
      Object.values(store.marketingProfile).some(v=>String(v||'').trim());
    const p = backendHasProfile
      ? {...base, ...store.marketingProfile, name:store?.name || base.name}
      : {...base, ...saved};
    $('#profileName').value = p.name || '';
    $('#profileNiche').value = p.niche || '';
    $('#profileAudience').value = p.audience || '';
    $('#profileRegion').value = p.region || '';
    $('#profileVoice').value = p.voice || '';
    $('#profileGoal').value = p.goal || '';
    $('#profileNetworks').value = p.networks || '';
    refreshProfilePreview(p);
    const who = p.name || (context==='loja'?'Sua loja':'Produtor');
    const niche = p.niche ? ` Identifiquei o nicho informado como “${p.niche}”.` : ' O nicho ainda pode ser completado nas configurações.';
    $('#agentsGreeting').textContent = `Olá, ${who} 👋.${niche} Escolha um agente ou diga ao Orquestrador o que deseja divulgar.`;
    document.title = `AI Marketing Pro — Agentes IA — ${who}`;
  }

  function currentProfile(){
    return {
      name:$('#profileName').value.trim(),
      niche:$('#profileNiche').value.trim(),
      audience:$('#profileAudience').value.trim(),
      region:$('#profileRegion').value.trim(),
      voice:$('#profileVoice').value.trim(),
      goal:$('#profileGoal').value.trim(),
      networks:$('#profileNetworks').value.trim()
    };
  }

  function refreshProfilePreview(p=currentProfile()){
    const fields = [
      ['Marca',p.name||'Não informado'],
      ['Nicho',p.niche||'Ainda não definido'],
      ['Público',p.audience||'Ainda não definido'],
      ['Região',p.region||'Ainda não definida'],
      ['Objetivo',p.goal||'Ainda não definido']
    ];
    $('#profilePreview').innerHTML = fields.map(([a,b])=>`<div><span>${safe(a)}</span><strong>${safe(b)}</strong></div>`).join('');
  }

  function agentAvailable(a){
    return !a.contexts || a.contexts.includes(context);
  }

  function renderAgents(){
    const q = ($('#agentSearch')?.value || '').toLowerCase().trim();
    const list = agents.filter(agentAvailable).filter(a=>{
      if(currentFilter==='favoritos' && !favorites.has(a.id)) return false;
      if(!['todos','favoritos'].includes(currentFilter) && !a.tags.includes(currentFilter)) return false;
      if(q && !(a.name+' '+a.desc+' '+a.tags.join(' ')).toLowerCase().includes(q)) return false;
      return true;
    });
    $('#agentGrid').innerHTML = list.map(a=>`
      <article class="amp-agent-card" data-agent="${a.id}">
        <button class="amp-agent-favorite ${favorites.has(a.id)?'is-favorite':''}" type="button" data-favorite="${a.id}" title="Favorito">★</button>
        <div class="amp-agent-icon">${safe(a.icon)}</div>
        <h3>${safe(a.name)}</h3>
        <div class="amp-agent-tags">${a.tags.slice(0,4).map(t=>`<span>${safe(t.toUpperCase())}</span>`).join('')}</div>
        <p>${safe(a.desc)}</p>
        <button class="amp-agent-open" type="button" data-open-agent="${a.id}">Abrir agente</button>
      </article>
    `).join('') || '<div class="amp-empty-state">Nenhum agente encontrado para este filtro.</div>';
  }

  function openDrawer(tab='perfil'){
    $('#agentsDrawer').classList.add('is-open');
    $('#agentsDrawerBackdrop').classList.add('is-open');
    $('#agentsDrawer').setAttribute('aria-hidden','false');
    selectTab(tab);
  }
  function closeDrawer(){
    $('#agentsDrawer').classList.remove('is-open');
    $('#agentsDrawerBackdrop').classList.remove('is-open');
    $('#agentsDrawer').setAttribute('aria-hidden','true');
  }
  function selectTab(tab){
    $$('.amp-drawer-tabs button').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===tab));
    $$('.amp-drawer-panel').forEach(p=>p.classList.toggle('is-active',p.dataset.panel===tab));
    const names={perfil:'Perfil e contexto',jornada:'Jornada Inteligente',ideias:'Laboratório de Ideias',calendario:'Calendário',ajuda:'Ajuda',agente:'Agente'};
    $('#drawerTitle').textContent=names[tab]||'Configurações';
  }

  function openAgent(id){
    const a = agents.find(x=>x.id===id);
    if(!a) return;
    $('#agentDetail').innerHTML = `
      <span class="amp-kicker">AGENTE EXECUTOR</span>
      <h3>${safe(a.icon)} ${safe(a.name)}</h3>
      <div class="amp-agent-tags">${a.tags.map(t=>`<span>${safe(t.toUpperCase())}</span>`).join('')}</div>
      <p>${safe(a.desc)}</p>
      <div class="amp-agent-detail-box">
        <strong>Contexto reconhecido</strong>
        <p>${safe(currentProfile().name || (context==='loja'?'Sua Loja':'Provador Pro'))} · ${safe(currentProfile().niche || 'nicho a completar')}</p>
      </div>
      <button class="amp-btn" type="button" id="agentPrepareIdea">Preparar ideia para este agente</button>
      <button class="amp-btn amp-btn-secondary" type="button" disabled>Executar com IA — próxima etapa</button>
      <p class="amp-note">Nesta etapa o painel e a configuração estão prontos. A execução generativa será ligada depois da validação funcional do AI Marketing Pro.</p>
    `;
    openDrawer('agente');
    setTimeout(()=>{
      $('#agentPrepareIdea')?.addEventListener('click',()=>{
        selectTab('ideias');
        $('#ideaOriginal').focus();
      });
    },0);
  }

  function recommendAgents(){
    const text = $('#orchestratorIdea').value.toLowerCase().trim();
    if(!text){
      $('#orchestratorResult').innerHTML = '<span>Digite primeiro o que deseja divulgar.</span>';
      return;
    }
    const rules = [
      [['video','reels','reel','short','tiktok'],['video-curto','ganchos','copy-legenda']],
      [['anuncio','ads','trafego','meta','google'],['anuncios','publicos-ads','publico-alvo']],
      [['produto','roupa','look','colecao','vestido','blazer'], context==='loja'?['divulga-produto','copy-legenda','stories']:['campanha-provador','copy-pagina','anuncios']],
      [['story','stories'],['stories','copy-legenda','ganchos']],
      [['youtube'],['roteirista-youtube','youtube-seo','thumbnail']],
      [['pagina','landing','checkout','oferta'],['copy-pagina','vsl','ganchos']],
      [['whatsapp'],['whatsapp','copy-legenda']],
      [['local','cidade','bairro','regiao'], context==='loja'?['campanha-local','publicos-ads','top-canais']:['top-canais','publicos-ads']],
      [['calendario','semana','mes','dias','todo dia'],['calendario','radar','ideias-virais']]
    ];
    const ids=[];
    for(const [terms,picks] of rules){
      if(terms.some(t=>text.includes(t))) picks.forEach(id=>{if(!ids.includes(id))ids.push(id)});
    }
    if(!ids.length) ['publico-alvo','ideias-virais','ganchos','copy-legenda'].forEach(id=>ids.push(id));
    const picks=ids.map(id=>agents.find(a=>a.id===id)).filter(Boolean).filter(agentAvailable).slice(0,6);
    $('#orchestratorResult').innerHTML = `
      <strong>Prévia de agentes recomendados</strong>
      <div class="amp-orchestrator-picks">${picks.map((a,i)=>`<button type="button" data-open-agent="${a.id}"><b>${i+1}. ${safe(a.name)}</b><span>${safe(a.desc)}</span></button>`).join('')}</div>
      <small>Recomendação local por palavras-chave. Ainda não representa execução generativa por IA.</small>
    `;
  }

  function buildJourney(){
    const p=currentProfile();
    const steps=[
      ['1. Descoberta e posicionamento', p.niche && p.audience ? 'Base preenchida' : 'Completar nicho e público'],
      ['2. Prioridade de canais', p.networks ? `Priorizar: ${p.networks}` : 'Definir canais'],
      ['3. Ideias e conteúdo', 'Usar Ideias Virais, Ganchos e formato adequado'],
      ['4. Criativo e copy', 'Preparar vídeo/post, legenda, CTA e oferta'],
      ['5. Calendário', 'Definir frequência e modo Manual / Aprovação / Automático'],
      ['6. Publicação e aprendizado', 'Medir resultado quando métricas/conectores estiverem ativos']
    ];
    $('#journeySteps').innerHTML=steps.map(([t,d],i)=>`<div class="amp-journey-step"><span>${i+1}</span><div><strong>${safe(t)}</strong><p>${safe(d)}</p></div></div>`).join('');
  }

  function loadSchedule(){
    const s=loadJSON(scheduleKey(),{frequency:'diario',time:'19:00',mode:'manual',formats:'Reels/Short, Story, Post, Carrossel',goals:'Atração, engajamento e vendas'});
    $('#scheduleFrequency').value=s.frequency;
    $('#scheduleTime').value=s.time;
    $('#publishMode').value=s.mode;
    $('#scheduleFormats').value=s.formats;
    $('#scheduleGoals').value=s.goals;
    updateScheduleNotice();
  }
  function updateScheduleNotice(){
    const mode=$('#publishMode').value;
    $('#scheduleNotice').textContent = mode==='automatico'
      ? 'Publicação automática ficará disponível somente após conexão OAuth/API oficial da plataforma. Nenhuma publicação automática está ativa agora.'
      : mode==='aprovacao'
      ? 'Conteúdos poderão ficar na fila aguardando aprovação antes da publicação quando a etapa funcional estiver ligada.'
      : 'Modo Manual: a criação pode ser organizada aqui e o usuário publica quando desejar.';
  }

  $('#agentSearch').addEventListener('input',renderAgents);
  $('#agentFilters').addEventListener('click',e=>{
    const b=e.target.closest('button[data-filter]'); if(!b) return;
    currentFilter=b.dataset.filter;
    $$('#agentFilters button').forEach(x=>x.classList.toggle('is-active',x===b));
    renderAgents();
  });
  $('#agentGrid').addEventListener('click',e=>{
    const fav=e.target.closest('[data-favorite]');
    if(fav){
      const id=fav.dataset.favorite;
      favorites.has(id)?favorites.delete(id):favorites.add(id);
      saveJSON(favKey(),Array.from(favorites));
      renderAgents(); return;
    }
    const open=e.target.closest('[data-open-agent]');
    if(open) openAgent(open.dataset.openAgent);
  });
  $('#orchestratorResult').addEventListener('click',e=>{
    const open=e.target.closest('[data-open-agent]'); if(open) openAgent(open.dataset.openAgent);
  });

  $('#orchestratorRecommend').addEventListener('click',recommendAgents);
  $('#openConfigBtn').addEventListener('click',()=>openDrawer('perfil'));
  $('#agentsDrawerToggle').addEventListener('click',()=>openDrawer('perfil'));
  $('#agentsDrawerClose').addEventListener('click',closeDrawer);
  $('#agentsDrawerBackdrop').addEventListener('click',closeDrawer);
  $$('.amp-drawer-tabs button').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.tab)));

  $('#saveProfile').addEventListener('click',async()=>{
    const p=currentProfile();
    try{
      if(context === 'loja'){
        const response = await fetch('/api/session/store-marketing-profile',{
          method:'PUT',
          credentials:'same-origin',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(p)
        });
        const data = await response.json().catch(()=>({}));
        if(!response.ok){
          throw new Error(data.error || 'Não foi possível salvar o perfil.');
        }
        if(data.store) store = data.store;
      }
      saveJSON(profileKey(),p);
      refreshProfilePreview(p);
      initProfile();
      $('#saveProfile').textContent='Salvo ✓';
      setTimeout(()=>$('#saveProfile').textContent='Salvar perfil',1200);
    }catch(err){
      $('#saveProfile').textContent='Erro ao salvar';
      alert(err.message || 'Não foi possível salvar o perfil.');
      setTimeout(()=>$('#saveProfile').textContent='Salvar perfil',1800);
    }
  });
  $('#buildJourney').addEventListener('click',buildJourney);
  $('#structureIdea').addEventListener('click',()=>{
    const raw=$('#ideaOriginal').value.trim();
    const p=currentProfile();
    if(!raw){$('#ideaStructured').value='Digite sua ideia primeiro.';return}
    $('#ideaStructured').value=`IDEIA ORIGINAL: ${raw}\n\nCONTEXTO: ${p.name||''}${p.niche?` · ${p.niche}`:''}${p.audience?` · Público: ${p.audience}`:''}\n\nOBJETIVO: ${p.goal||'definir'}\n\nPEDIDO PARA A IA: preserve a intenção original, melhore clareza, gancho, formato, CTA e adequação ao canal sem inventar fatos sobre a marca.`;
  });
  $('#publishMode').addEventListener('change',updateScheduleNotice);
  $('#saveSchedule').addEventListener('click',()=>{
    const s={frequency:$('#scheduleFrequency').value,time:$('#scheduleTime').value,mode:$('#publishMode').value,formats:$('#scheduleFormats').value.trim(),goals:$('#scheduleGoals').value.trim()};
    saveJSON(scheduleKey(),s); updateScheduleNotice();
    $('#saveSchedule').textContent='Salvo ✓'; setTimeout(()=>$('#saveSchedule').textContent='Salvar configuração',1200);
  });

  loadSchedule();
  buildJourney();
  resolveContext();
})();
