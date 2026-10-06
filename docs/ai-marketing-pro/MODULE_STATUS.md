# MODULE STATUS

| Módulo | Produtor | Lojista | Estado Fase 1 |
|---|---|---|---|
| Hub AI Marketing Pro | Base | Base | Implementado para validação local |
| Páginas de Vendas | Estrutura | Estrutura | Núcleo visual criado; funcionalidades planejadas |
| Marketing | Base | Base | Estrutura criada |
| Redes Sociais | Parcial | Parcial | Ferramentas atuais preservadas |
| Calendário | Parcial | Parcial | Existente preservado |
| Tráfego Pago | Planejado | Planejado | Não implementado |
| CRM | Planejado | Planejado | Não implementado |
| Atendimento | Planejado | Planejado | Não implementado |
| Automações | Planejado | Planejado | Não implementado |
| Vendas avançadas | Planejado | Planejado | Não implementado |
| Afiliados | Planejado | Planejado | Não implementado |
| Financeiro | Planejado | Planejado | Não implementado |
| Analytics | Planejado | Planejado | Não implementado |
| IA própria | Planejado | Planejado | Não implementado |

## Fase 2
| Recurso | Produtor | Lojista | Estado |
|---|---|---|---|
| Funil Inteligente - UI/arquitetura | Estrutura | Estrutura | Criado para validação |
| Captura de Leads | Planejado | Planejado | Documentado, não implementado |
| Etapas/Timeline | Planejado | Planejado | Documentado, não implementado |
| Pixel/Tags/Remarketing | Planejado | Planejado | Documentado, não implementado |
| Recuperação WhatsApp/E-mail | Planejado | Planejado | Documentado, não implementado |
| Lead Scoring | Planejado | Planejado | Documentado, não implementado |
| Central de Ajuda | Base | Base | Criada |
| PDFs contextuais | Base | Base | Criados para itens da Fase 2 |
| Vídeos contextuais | Em preparação | Em preparação | Áreas reservadas |


## Fase 3
- Tráfego Pago + Orgânico: **FUNCIONAL LOCAL** (estratégia, rascunho, revisão e validação).
- Estratégia local / redução de cliques: **FUNCIONAL LOCAL**.
- Validador de políticas/formato: **FUNCIONAL LOCAL / SNAPSHOT**, sincronização oficial automática ainda pendente.
- Publicação externa: **BLOQUEADA ATÉ OAUTH/API**.
- Creative Studio Pro: **FUNCIONAL LOCAL PARA BRIEFING/PRÉVIA**, geração visual IA real pendente.


## Fase 4
- Construtor de Sites Pro: BASE LOCAL FUNCIONAL.
- Prévia responsiva: FUNCIONAL LOCAL.
- Carregamento de dados da loja: FUNCIONAL quando sessão/API pública retorna loja.
- WhatsApp qualificado + transferência por link: FUNCIONAL LOCAL.
- Checkout do Produtor: ADAPTADOR para `/checkout.html`.
- Checkout da Loja: ROTA CONFIGURÁVEL para reaproveitar o checkout existente; integração pública final deve ser validada antes de produção.
- Domínio/publicação: PLANEJADO.
- WhatsApp API oficial/bot externo: PLANEJADO.


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
