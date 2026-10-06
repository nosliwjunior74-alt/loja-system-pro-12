# RESPONSABILIDADES

## Produtor
Gerencia marketing e vendas do Provador Pro, planos, módulos, campanhas institucionais e leads do próprio negócio.

## Lojista
Gerencia somente marketing, vendas, campanhas, produtos, leads e métricas da sua loja.

## Sistema
Garantir isolamento de dados, permissões, auditoria, segurança, responsividade, desempenho e gavetas para recursos secundários.

## Desenvolvimento
Não duplicar módulos, registrar decisões, validar por etapas, preservar rollback e usar somente código próprio ou dependências com licença compatível.

## Documentação
O desenvolvimento de cada recurso inclui atualização do manual, PDF e área de vídeo correspondente. Quando Produtor e Lojista tiverem fluxos diferentes, a ajuda deve distinguir os dois contextos.

## Privacidade e rastreamento
O sistema deve registrar consentimento e respeitar a finalidade dos dados antes de habilitar pixels, tags, e-mail, WhatsApp ou automações de remarketing.


## Fase 3
- Gerador: cria estratégia e rascunho.
- Validador: aponta riscos e checklist; não garante aprovação.
- Conector: autentica/publica somente após autorização.
- Creative Studio: produz ativos visuais sem duplicar regras de campanha.


## Fase 4
- Construtor: montar configuração e prévia sem misturar lojas.
- Runtime do site: mostrar conteúdo e encaminhar Provador/checkout/WhatsApp.
- Checkout: continuar sendo responsabilidade do motor existente; o Construtor apenas referencia a rota correta.
- WhatsApp: qualificar no site e transferir com contexto; API oficial externa será módulo de integração posterior.


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
