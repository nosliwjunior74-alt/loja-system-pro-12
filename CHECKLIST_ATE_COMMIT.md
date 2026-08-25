# CHECKLIST OFICIAL ATE OS COMMITS

## PONTO ATUAL
Motor Central IA das Lojas — concluir e fazer commit primeiro.

## IA — JA CONCLUIDO
[✓] Endpoint /api/public/ai-chat
[✓] Chatbot do site conectado ao Motor Central IA
[✓] Fallback de respostas rapidas e WhatsApp preservado
[✓] OPENAI_API_KEY fora do codigo
[✓] IA testada na LOJA TESTE A
[✓] Tabela ai_usage_monthly criada
[✓] Consumo separado por loja e por mes
[✓] Registro de requests e tokens
[✓] Teste com rollback
[✓] Consumo real da OpenAI registrado
[✓] LOJA TESTE A registrou 1 atendimento e 463 tokens
[✓] Campo plan ja existe no banco
[✓] LOJA TESTE A e B atualmente no plano premium

## IA — FALTA ANTES DO COMMIT
[?] Criar limites por plano
[?] Limites validados:
    Simples = 100
    Profissional = 500
    Premium = 1500

    Simples = 100 atendimentos/mes
    Profissional = 500 atendimentos/mes
    Premium = 1500 atendimentos/mes
[?] Bloquear a chamada antes de enviar para OpenAI quando atingir o limite
[?] Garantir que uma loja nao consuma limite de outra
[?] Testar LOJA TESTE A
[?] Testar LOJA TESTE B
[?] Testar persistencia apos reiniciar servidor
[?] Testar novo periodo mensal
[?] Testar fallback quando IA estiver indisponivel
[?] node --check db.js
[?] node --check server.js
[?] node --check public/js/chatbot-vendas.js
[?] Teste visual final do chatbot
[ ] git status --short
[ ] git diff --check
[ ] Auditar arquivos antes de staging
[ ] Nao incluir .bak, data, SQLite, node_modules ou segredos
[?] Fazer commit seguro da etapa IA ? commit 0126f86

## PROXIMA FRENTE APOS O COMMIT DA IA
Profissionalizacao antiga das lojas.

## TELA DE DESCANSO — FALTA TERMINAR
[ ] Finalizar area de videos promocionais
[ ] Finalizar carrossel/slideshow
[ ] Alternancia automatica entre imagens e videos
[ ] Tempo de exibicao das midias
[ ] Loop dos videos
[ ] Testar somente imagem
[ ] Testar somente video
[ ] Testar varias midias
[ ] Evitar tela preta/piscadas nas trocas
[ ] Garantir midias separadas por loja
[ ] Finalizar administracao das midias pelo lojista
[ ] Testar TV vertical
[ ] Preservar proporcao sem esticar imagem/pessoa
[ ] Testar desktop
[ ] Testar celular
[ ] Validacao visual final

## REVISAO ANTIGA DAS LOJAS
[ ] Revisao final Painel da Loja
[ ] Revisao final Vitrine e filtros
[ ] Revisao final Catalogo
[ ] Revisao final Provador
[ ] Revisao dos botoes Vitrine/Catalogo/Provador/Descanso
[ ] Revisao Clientes da Loja
[ ] Revisao Backups por loja
[ ] Revisao redefinicao de senha
[ ] Revisao formas de pagamento
[ ] Revisao Atendimento e WhatsApp
[ ] Testes de isolamento entre lojas
[ ] Fazer commit seguro da profissionalizacao antiga

## FUTURO — NAO FAZER AGORA
[ ] Upgrade/downgrade comercial completo
[ ] Gateway de pagamento
[ ] 30 dias gratis/carencia
[ ] Cobranca recorrente
[ ] Bloqueio por inadimplencia
[ ] Reativacao automatica apos pagamento
[ ] WhatsApp Business API com IA
[ ] Bot comercial do produtor

## REGRA DE RETOMADA
Nunca refazer uma etapa marcada [✓].
Ao parar, registrar aqui a ultima tarefa concluida e a proxima tarefa.


## COMMITS DE SEGURANCA CONCLUIDOS
[?] 3ec15a7 ? Profissionaliza paineis, seguranca, clientes e gestao multiloja
[?] 0126f86 ? Adiciona Motor Central IA com consumo e limites por loja


## VALIDACAO TELA DE DESCANSO
[?] Playlist aceita foto e video
[?] Video avanca automaticamente quando termina
[?] Foto respeita tempo configurado
[?] Ciclo video -> foto -> video funcionando
[?] Preencher a tela usa cover
[?] Mostrar imagem inteira preservado com contain
[?] Lista de arquivos de midia ficou retratil no painel
[?] Adicionar botao Voltar ao Provador
[?] Adicionar botao Voltar ao Painel da Loja
