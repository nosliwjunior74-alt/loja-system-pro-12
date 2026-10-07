# ARQUITETURA

## Princípio
Um único AI Marketing Pro, sem duplicação de módulos, com escopo por contexto.

## Contextos
- `producer`: dados pertencentes ao Produtor.
- `store:<storeId>`: dados pertencentes a uma loja específica.

## Regra de isolamento
Toda entidade futura deve carregar o contexto proprietário: páginas, campanhas, leads, contatos, automações, integrações, métricas, anúncios, ofertas e eventos.

## Camadas planejadas
- Hub/UI modular.
- Serviços de domínio por módulo.
- Persistência central por contexto.
- Adaptadores de integrações externas.
- Motor de IA próprio.
- Auditoria e permissões.

## Compatibilidade
As ferramentas atuais do Display Pro são preservadas durante a migração e acessadas em gavetas. Nenhuma função futura deve ser apresentada como ativa antes da implementação e validação.

## Camada de Funil Inteligente
Entidades futuras previstas por contexto:
- lead;
- origem/campanha;
- evento;
- etapa do funil;
- sessão;
- oferta;
- checkout;
- conversão;
- segmento;
- regra de automação;
- consentimento.

## Documentação como parte da arquitetura
A Central de Ajuda é componente oficial. Cada recurso terá ajuda contextual, vídeo e PDF. Vídeos ainda não gravados devem aparecer explicitamente como Em preparação.


## Publicação e Creative Studio
A Central de Anúncios usa contexto Produtor/Loja e resolve a loja ativa pela sessão quando aplicável. Rascunhos locais usam namespace por contexto/loja. Conectores externos serão adaptadores OAuth/API, separados do gerador e do validador.


## Construtor de Sites Pro
Módulo vendável e integrado. Contextos `produtor` e `loja` compartilham o mesmo motor, com chaves de persistência separadas. O runtime do site recebe configuração, produtos e rotas de Provador/checkout do contexto. Publicação real e domínio permanecem desacoplados até backend específico ser validado.


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

## Agentes IA + Jornada Inteligente V1 (07/10/2026)
- Um único acesso `Agentes IA` por contexto evita poluição visual.
- A tela compartilhada recebe `?context=produtor|loja`.
- Palavras-chave são filtros; cards grandes são agentes executores.
- Orquestrador recomenda agentes; nesta V1 a recomendação é local/estrutural, sem fingir IA externa.
- Configurações, Jornada, Ideias, Calendário e Ajuda ficam em gaveta lateral direita.
- Perfil do Lojista reaproveita a sessão da loja e complementa nicho/público/região em armazenamento isolado por loja.
- Produtor usa contexto próprio do Provador Pro.

## Perfil de Marketing automático V1
- Cadastro manual do Produtor e checkout alimentam `marketingProfile` da loja.
- Perfil persistido no banco por loja e entregue por `/api/session/store-config`.
- Central Lateral permanece editável e salva via `/api/session/store-marketing-profile`.
- Isolamento por loja e reutilização entre dispositivos.
