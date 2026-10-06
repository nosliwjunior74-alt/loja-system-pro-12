# DECISÕES TÉCNICAS

## DT-001 — Um produto, dois contextos
Não criar dois AI Marketing Pro. O mesmo módulo opera em contexto Produtor ou Loja.

## DT-002 — Isolamento obrigatório
Todo dado futuro terá proprietário/contexto explícito. Nenhum dado de uma loja poderá aparecer em outra.

## DT-003 — Páginas de Vendas como núcleo
Páginas de Vendas não ficará escondida dentro de Marketing; terá acesso principal nos dois contextos.

## DT-004 — Interface sem poluição
Ferramentas avançadas, filtros, configurações, integrações e históricos ficam em gavetas fechadas por padrão.

## DT-005 — Migração sem regressão
Ferramentas existentes do Display Pro continuam disponíveis durante a evolução.

## DT-006 — Status verdadeiro
Recursos não implementados aparecem como Planejado, nunca como funcionais.

## DT-007 - Funil Inteligente obrigatório
O AI Marketing Pro terá funil por contexto com captura, etapas, timeline, abandono, recuperação, remarketing, scoring e métricas.

## DT-008 - Rastreamento com consentimento
Pixels, tags, cookies e APIs de conversão só serão ativados com controles de consentimento e privacidade compatíveis com LGPD.

## DT-009 - Documentação é critério de conclusão
Nenhum recurso será considerado finalizado sem manual detalhado, área de vídeo e PDF atualizados.


## Fase 3
- Não depender do Canva: integração futura opcional; núcleo visual próprio.
- Publicação real nunca é simulada.
- Regras de plataforma são versionadas e devem apontar para referências oficiais.
- Estratégia de campanha deve considerar geografia, intenção, exclusões e etapa do funil.


## Fase 4
- Não duplicar checkout.
- Não criar site separado por código: um runtime parametrizado por contexto/loja.
- WhatsApp V1 usa qualificação no site + `wa.me` com resumo, sem fingir API oficial.
- Publicação/domínio não são marcados como ativos nesta fase.
- Configurações avançadas permanecem em gavetas.


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

- Contexto visual do Painel Mestre: ao abrir AI Marketing Pro no contexto PRODUTOR, o shell exibe identidade do Produtor/Loja Mestre em vez da identidade da loja selecionada; ao sair do contexto Produtor, a identidade da loja e restaurada.
