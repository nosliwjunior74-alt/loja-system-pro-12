(() => {
  const qs = new URLSearchParams(location.search);
  const context = qs.get('context') === 'loja' ? 'loja' : 'produtor';
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc = (s='') => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const nowIso = () => new Date().toISOString();
  const state = { context, storeKey: context==='produtor' ? 'producer' : 'store-unknown', store:null };
  async function resolveStore(){
    if(context==='produtor') return state;
    try{
      const r=await fetch('/api/session/store-config',{credentials:'same-origin'}); const j=await r.json();
      if(j?.store){ state.store=j.store; state.storeKey='store-'+(j.store.id||j.store.slug||'selected'); }
    }catch(_){ }
    return state;
  }
  function key(name){ return `amp:v3:${state.storeKey}:${name}`; }
  function load(name,fallback){ try{const v=JSON.parse(localStorage.getItem(key(name)));return v??fallback}catch(_){return fallback} }
  function save(name,v){ localStorage.setItem(key(name),JSON.stringify(v)); return v; }
  function policySnapshot(platform){
    const map={
      google:{label:'Google Ads / Perfil da Empresa',checks:['Evitar promessas enganosas ou impossíveis.','Definir localização coerente com a operação real.','Usar palavras-chave negativas para reduzir buscas irrelevantes.','Landing page deve corresponder à oferta e funcionar corretamente.'],ref:'https://support.google.com/google-ads/'},
      meta:{label:'Meta / Instagram / Facebook',checks:['Criativo e texto não devem induzir erro.','Segmentação deve respeitar categorias e restrições aplicáveis.','Página de destino deve corresponder ao anúncio.','Evitar linguagem que atribua características pessoais sensíveis ao usuário.'],ref:'https://transparency.meta.com/policies/ad-standards/'},
      tiktok:{label:'TikTok',checks:['Formato e funcionalidade do anúncio devem estar adequados.','Landing page precisa funcionar e corresponder à oferta.','Evitar conteúdo proibido ou afirmações enganosas.','Criativo deve respeitar requisitos do formato escolhido.'],ref:'https://ads.tiktok.com/help/article/tiktok-ads-policy-ad-format-and-functionality'},
      pinterest:{label:'Pinterest',checks:['Criativo precisa ser claro e compatível com a página de destino.','Evitar conteúdo proibido/restrito.','Respeitar especificações do formato.','Não usar práticas enganosas.'],ref:'https://policy.pinterest.com/pt-br/advertising-guidelines'},
      linkedin:{label:'LinkedIn',checks:['Conteúdo deve ser profissional e relevante.','Anúncio passa por análise da plataforma.','Página de destino deve ser funcional e coerente.','Evitar alegações enganosas e categorias proibidas.'],ref:'https://br.linkedin.com/legal/ads-policy'}
    }; return map[platform]||map.meta;
  }
  function stageAdvice(stage){
    return ({visitou:'Conteúdo educativo e prova social; evite pressão de compra.',lead:'Oferta de valor e esclarecimento de dúvidas.',oferta:'Remarketing com benefício, prova e CTA objetivo.',checkout:'Recuperação de checkout com urgência legítima e suporte.',pendente:'Lembrete de pagamento/suporte sem excesso de mensagens.',comprou:'Excluir da campanha de aquisição e migrar para pós-venda/upsell apropriado.'})[stage]||'Mensagem alinhada à intenção atual do lead.';
  }
  function buildStrategy(data){
    const p=policySnapshot(data.platform);
    const local = data.local==='sim';
    const organic = data.mode==='organico';
    const lines=[];
    lines.push(`Objetivo: ${data.goal}. Plataforma: ${p.label}. Modo: ${organic?'Orgânico':'Tráfego pago'}.`);
    if(local) lines.push(`Estratégia local: priorizar presença na região ${data.location||'definida pela loja'}${data.radius?`, raio inicial de ${data.radius} km`:''}; revisar presença x interesse conforme o canal.`);
    if(data.platform==='google' && !organic) lines.push('Redução de cliques desperdiçados: usar intenção comercial, termos específicos e lista de palavras-chave negativas; revisar termos de pesquisa antes de ampliar orçamento.');
    lines.push(`Etapa do funil: ${data.stage}. ${stageAdvice(data.stage)}`);
    lines.push(`Orçamento inicial: ${data.budget||'definir'}; otimizar por conversão real, não apenas por clique.`);
    lines.push('Pré-publicação: revisar oferta, público, criativo, CTA, landing page, rastreamento/consentimento e regras atuais da plataforma.');
    return lines;
  }
  function generateAd(data){
    const name=data.product|| (context==='produtor'?'Provador Pro':'produto da loja');
    const city=data.location?` em ${data.location}`:'';
    const stage = stageAdvice(data.stage);
    const variants={
      google:{title:`${name}${city} | Conheça agora`,text:`Descubra ${name}. Oferta clara, atendimento e próxima etapa simples. ${data.cta||'Saiba mais'}.`},
      meta:{title:`${name}: veja como funciona`,text:`Uma opção pensada para quem busca ${data.benefit||'praticidade e resultado'}. Confira os detalhes e escolha a melhor opção para você.`},
      tiktok:{title:`Veja ${name} em ação`,text:`Conteúdo direto, visual e curto: problema → demonstração → benefício → ${data.cta||'saiba mais'}.`},
      pinterest:{title:`Inspiração: ${name}`,text:`Salve esta ideia e veja detalhes de ${name}. ${data.benefit||'Uma solução visual e prática para sua necessidade.'}`},
      linkedin:{title:`${name} para resultados comerciais`,text:`Conheça uma abordagem profissional para ${data.benefit||'otimizar a operação e gerar oportunidades'}.`}
    };
    const v=variants[data.platform]||variants.meta;
    return {...v, stageNote:stage, generatedAt:nowIso(), platform:data.platform, mode:data.mode};
  }
  function validateAd(data,ad){
    const p=policySnapshot(data.platform); const issues=[]; const warnings=[];
    const all=(ad.title+' '+ad.text).toLowerCase();
    ['garantido','100% garantido','resultado garantido','cura','milagre'].forEach(x=>{if(all.includes(x)) issues.push(`Evitar alegação de alto risco: “${x}”.`)});
    if(!data.product) warnings.push('Defina claramente o produto/oferta.');
    if(data.mode==='pago' && data.platform==='google' && !data.negativeKeywords) warnings.push('Adicione palavras-chave negativas para reduzir cliques irrelevantes.');
    if(data.local==='sim' && !data.location) issues.push('Campanha local exige localidade definida.');
    if(!data.destination) warnings.push('Defina uma página de destino antes da publicação real.');
    if(data.stage==='comprou' && data.goal==='aquisição') warnings.push('Lead comprador não deve permanecer em campanha de aquisição padrão.');
    return {ok:issues.length===0,issues,warnings,checks:p.checks,ref:p.ref,label:p.label,checkedAt:nowIso()};
  }
  function formatPlatform(v){return policySnapshot(v).label}
  window.AMP={state,resolveStore,key,load,save,policySnapshot,stageAdvice,buildStrategy,generateAd,validateAd,formatPlatform,esc,nowIso,$,$$};
})();