# MAPA DO CÓDIGO

## Interface
- `public/display_pro/index.html`: seletor de contexto quando aberto diretamente.
- `public/display_pro/produtor.html`: Hub do Produtor.
- `public/display_pro/loja.html`: Hub do Lojista.
- `public/display_pro/paginas-vendas.html`: núcleo compartilhado de Páginas de Vendas por contexto.
- `public/display_pro/style.css`: estilos legados + componentes AI Marketing Pro.

## Legado preservado
- `videos.html`: biblioteca de campanhas.
- `social.html`: disparo social atual.
- `agenda.html`: calendário atual.
- `admin.html`: painel legado de produtos.

## Próximas camadas
Persistência contextual, APIs, permissões, serviços de campanhas, CRM, páginas, analytics e integrações.

## Fase 2
- `public/display_pro/funil.html`: base visual/documental do Funil Inteligente.
- `public/display_pro/ajuda.html`: Central de Ajuda contextual.
- `public/display_pro/manuals/*.pdf`: PDFs por recurso.
- `public/display_pro/paginas-vendas.html`: ligação com Funil e ajuda contextual.


## Fase 3
- `public/display_pro/trafego.html`: estratégia, geração, revisão e publicação controlada.
- `public/display_pro/creative-studio.html`: briefing e prévia do módulo visual.
- `public/display_pro/ai-marketing-core.js`: contexto, armazenamento local, estratégia e validador.


## Fase 4
- `public/display_pro/site-builder.html` - editor/base do construtor.
- `public/display_pro/site-builder.js` - carregamento, persistência e prévia.
- `public/display_pro/site-preview.html` - runtime da prévia do site, carrossel, checkout, Provador e WhatsApp.


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
