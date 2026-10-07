# CHANGELOG

## Fase 1 — Hub e arquitetura inicial
- Criado Hub do Produtor.
- Reorganizado Hub do Lojista.
- Páginas de Vendas promovidas a núcleo central.
- Adotadas gavetas retráteis para controles secundários.
- Preservadas ferramentas atuais do Display Pro.
- Criada separação conceitual Produtor x Loja.
- Criada documentação oficial inicial.
- Nenhum módulo futuro foi marcado como ativo sem implementação.

## Fase 2 - Funil Inteligente e Central de Ajuda
- Criada base visual do Funil Inteligente.
- Mapeadas etapas Visitou → Lead → Oferta → Checkout → Compra.
- Adicionadas áreas planejadas de Pixel/Tags, Remarketing, Recuperação e Lead Scoring.
- Criada Central de Ajuda contextual.
- Criadas áreas de vídeo por item, marcadas como Em preparação.
- Criados PDFs dos recursos da Fase 2.
- Mantida separação Produtor x Lojista.
- Mantidas gavetas retráteis para evitar poluição visual.


### Fase 3
- Adicionadas Central de Anúncios, fluxo Gerar/Revisar/Publicar, estratégia local e segmentação por funil.
- Adicionado Creative Studio Pro como módulo separado e integrado.
- Publicação externa permanece bloqueada sem conta autorizada.


## Fase 4
Adicionado Construtor de Sites Pro, site-preview, carregamento de dados da loja, carrossel, integração de Provador, adaptador de checkout e qualificação de WhatsApp com transferência contextual.


## Fase 4.1 - Sites profissionais + Atendimento IA no WhatsApp
- Templates profissionais: Premium, Boutique, Minimalista e Moderno.
- Editor de seções com prévia responsiva.
- Atendimento IA no WhatsApp preparado para Produtor e Lojistas, com credenciais/contexto separados.
- Produtor: vendas do Provador Pro, planos, módulos e demonstrações.
- Lojista: atendimento de produtos da própria loja.
- Integração prevista com WhatsApp Business Platform/Cloud API ou provedor compatível.
- Entitlement próprio para venda do módulo aos lojistas.
- Transferência para humano, funil, checkout, consentimento/LGPD e logs fazem parte da arquitetura.
- Nenhuma integração externa é marcada como ativa antes de OAuth/API e testes reais.

- [2026-10-05 21:21] Checkout Online da Loja V1: tela publica separada do Caixa interno; customer_order pendente; preco/estoque validados no servidor; pagamento real da loja permanece para OAuth/API futura.

- [2026-10-05 22:30] Provador publico do Lojista: Construtor passa a usar /provador/index.html?loja=<slug>, evitando /s/<slug> e tela de login. Checkout e Caixa preservados.

- Contexto visual do Painel Mestre: ao abrir AI Marketing Pro no contexto PRODUTOR, o shell exibe identidade do Produtor/Loja Mestre em vez da identidade da loja selecionada; ao sair do contexto Produtor, a identidade da loja e restaurada.

- Ajuste V1.1 do contexto visual: o subtitulo do cabecalho deixa de exibir o subtitulo da loja selecionada enquanto o AI Marketing Pro estiver em modo PRODUTOR; ao sair, o texto original da loja e restaurado.

- MOBILE_AI_MARKETING_V1: correcao responsiva para Safari/iPhone no AI Marketing Pro, com bloqueio de text autosizing, empilhamento real dos cards, protecao contra overflow e ajuste do shell/iframe do Painel Mestre. Validacao visual mobile ainda pendente.

- AJUDA_MOBILE_V1: botao flutuante Ajuda compactado no celular para reduzir sobreposicao de cards; janela do chatbot tambem ajustada para largura/altura segura em iPhone.

- AJUDA_MOBILE_V2: no celular, o botao flutuante Ajuda passa a ser circular e exibir somente o icone de conversa, reduzindo a sobreposicao sobre CTAs e cards; desktop permanece com o texto completo.

- SERVICE_WORKER_DISPLAY_PRO_V2: cache do Display Pro alterado para v2; caches antigos display-pro-system-* sao removidos no activate; HTML/CSS/JS usam network-first com fallback offline; app.js solicita update do service worker ao carregar. Objetivo: impedir CSS/JS antigos presos em celulares apos deploy.

- AGENTES_IA_PAINEL_V1: adicionada estrutura de Agentes IA para Produtor e Lojista com filtros, favoritos, busca, Orquestrador local, perfil reconhecido, Jornada Inteligente, Laboratório de Ideias, calendário Manual/Aprovação/Automático e gaveta lateral direita. Execução generativa e publicação automática permanecem explicitamente futuras.

- PERFIL_MARKETING_AUTO_V1: cadastro e checkout alimentam Perfil de Marketing dos Agentes IA; Central Lateral salva no banco por loja; responsividade reforçada em celular, tablet, PC e TV.
