# MANUAL DO PRODUTOR — ETAPA 0

## Liberação da Loja + E-mail + WhatsApp

Este manual define o procedimento oficial do Produtor para criar, liberar, acompanhar e recuperar lojas no Provador Pro System.

## 1. Fluxo automático — pagamento pelo checkout

1. O cliente informa no checkout: Nome do cliente, Nome da Loja, E-mail, WhatsApp, Plano e Ciclo.
2. O pagamento é processado pelo checkout.
3. Quando o pagamento é confirmado:
   - a loja é criada automaticamente;
   - a licença é ativada;
   - o pagamento é registrado;
   - o cliente recebe e-mail de ativação;
   - o cliente recebe WhatsApp de ativação;
   - o cliente recebe link seguro de primeiro acesso.
4. No primeiro acesso o cliente cria a própria senha forte.
5. Nenhuma senha é enviada por e-mail ou WhatsApp.
6. Depois, o cliente faz login e, se a configuração inicial estiver pendente, é enviado para o formulário inicial.
7. Ao concluir Nome da Loja, E-mail, WhatsApp e Cor, a configuração inicial é marcada como concluída e o Dashboard é liberado.

## 2. Se o pagamento foi feito, mas a liberação automática falhou

Há dois casos diferentes:

### A. O pedido do checkout ainda aparece como pendente

Use quando o cliente enviou comprovante e o Produtor verificou que o dinheiro realmente entrou.

1. Abra **Pagamentos** no Painel Mestre.
2. Na área **Recuperação do checkout**, localize o pedido.
3. Confira Nome da Loja, E-mail, WhatsApp e valor.
4. Clique em **Confirmar pagamento e liberar**.
5. Confirme somente depois de verificar o recebimento.

O sistema:
- marca o pedido do checkout como `paid`;
- registra data, hora, origem `manual_producer` e administrador que confirmou;
- executa novamente o fluxo normal de pós-pagamento;
- cria e libera a loja se ela ainda não existir;
- registra o pagamento;
- mantém o primeiro acesso seguro;
- tenta enviar as notificações de ativação por e-mail e WhatsApp.

Se a liberação falhar depois da confirmação, o pedido permanece como pago para permitir nova tentativa sem cobrar novamente.

### B. O pedido já está pago, mas a loja não foi liberada

1. Abra **Pagamentos** no Painel Mestre.
2. Na área **Recuperação do checkout**, localize o pedido com status **Pago · liberação pendente**.
3. Clique em **Repetir liberação**.
4. Confirme a operação.

A repetição usa o mesmo fluxo seguro do pós-pagamento. Se a loja já tiver sido criada para aquele pedido, o sistema reutiliza a mesma loja e não cria outra.

**Importante:** a recuperação do checkout automático é diferente do botão **Confirmar pagamento** da cobrança de uma loja já existente. O botão da cobrança deve ser usado para pagamentos da loja/renovações quando o dinheiro foi realmente verificado.

## 3. Liberação Temporária por Confiança — 72 horas

Use somente quando o cliente enviou comprovante, mas o recebimento ainda não pôde ser confirmado.

Requisitos:
- loja sem licença ativa;
- cobrança pendente ou vencida.

Procedimento:
1. Selecione a loja no Painel Mestre.
2. Abra **Pagamentos**.
3. Clique em **Confiar 72h**.
4. Informe o motivo.
5. Confirme.

O sistema registra início, fim, administrador, motivo e status anterior.

Regras:
- dura exatamente 72 horas;
- se o pagamento for confirmado dentro do prazo, a licença normal assume e a confiança é encerrada;
- se o pagamento continuar pendente/vencido após 72 horas, a confiança é desativada e a loja volta para `inativo`;
- o Produtor pode cancelar antes do prazo em **Cancelar confiança**;
- somente o Produtor/Administrador Mestre pode conceder ou cancelar.

A Confiança 72h não substitui confirmação de pagamento.

## 4. Fluxo manual/local

Use para cliente local ou venda feita fora do checkout automático.

1. No Painel Mestre, crie uma nova loja.
2. Preencha obrigatoriamente:
   - Nome da Loja;
   - E-mail;
   - WhatsApp.
3. Defina plano, ciclo e demais dados necessários.
4. Crie uma senha inicial forte.
5. Salve a loja.

Depois da criação:
- a configuração inicial fica pendente;
- o primeiro login exige troca obrigatória da senha;
- o sistema envia e-mail de boas-vindas;
- o sistema tenta enviar WhatsApp de boas-vindas;
- a senha não é enviada nas mensagens.

A senha inicial deve ser informada diretamente pelo Produtor ao cliente por canal apropriado.

## 5. Primeiro acesso e senha

### Fluxo automático
O cliente recebe um link seguro e cria a própria senha.

### Fluxo manual/local
O cliente entra com a senha inicial fornecida pelo Produtor e é obrigado a criar uma nova senha.

A nova senha deve ter no mínimo 10 caracteres com:
- letra maiúscula;
- letra minúscula;
- número;
- símbolo.

A sessão de troca obrigatória de senha é temporária. Se expirar, o cliente deve fazer login novamente.

## 6. Configuração inicial

Campos principais:
- Nome da Loja;
- E-mail;
- WhatsApp;
- Cor principal.

Ao concluir:
- os dados são atualizados;
- o WhatsApp é validado/normalizado;
- `initialSetupCompleted` passa para `true`;
- o Dashboard da Loja é liberado.

Lojas antigas são preservadas pela migração de compatibilidade.

## 7. E-mail de boas-vindas

### Automático
Enviado após pagamento confirmado. Contém:
- nome do cliente;
- nome da loja;
- plano;
- ciclo;
- valor;
- link seguro de primeiro acesso.

### Manual/local
Enviado após o Produtor criar a loja. Contém:
- nome do cliente/loja;
- plano;
- link de login;
- orientação sobre a senha inicial fornecida pelo administrador;
- aviso de troca obrigatória.

Nenhum e-mail contém senha.

Configuração SMTP do servidor:
- `PRO_SMTP_HOST`
- `PRO_SMTP_PORT`
- `PRO_SMTP_SECURE`
- `PRO_SMTP_USER`
- `PRO_SMTP_PASS`
- `PRO_EMAIL_FROM`
- `PRO_EMAIL_REPLY_TO`

Nunca registrar senhas ou tokens reais neste manual.

## 8. WhatsApp de boas-vindas

Usa a API oficial da Meta.

Configurações principais:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

Template automático:
- `PRO_WHATSAPP_ACTIVATION_TEMPLATE_NAME`

Parâmetros, nesta ordem:
1. Nome do cliente
2. Nome da loja
3. Plano
4. Link seguro de primeiro acesso

Template manual/local:
- `PRO_WHATSAPP_MANUAL_WELCOME_TEMPLATE_NAME`
- `PRO_WHATSAPP_MANUAL_WELCOME_TEMPLATE_LANG`

Parâmetros, nesta ordem:
1. Nome do cliente
2. Nome da loja
3. Plano
4. Link de login da loja

O template precisa estar aprovado na Meta antes do envio real. Nenhum template deve conter senha.

## 9. Quando o cliente enviar comprovante pelo WhatsApp

### Dinheiro já confirmado como recebido
Use **Confirmar pagamento**.

Resultado:
- cobrança paga;
- licença ativada/renovada;
- auditoria registrada;
- Confiança 72h encerrada, se existir.

### Dinheiro ainda não confirmado
Se a loja estiver bloqueada e houver cobrança pendente/vencida, use **Confiar 72h**.

### Comprovante inválido ou situação duvidosa
Não confirme pagamento e não libere por confiança até verificar.

## 10. Bloqueio, recuperação e senha

- Sem pagamento e com licença vencida, a loja fica inativa conforme a regra de licença.
- Confiança vencida sem pagamento volta automaticamente para inativo.
- Depois do pagamento confirmado:
  - mensal: renovação de 30 dias;
  - anual: renovação de 365 dias.
- O Produtor pode localizar a loja, conferir cobranças, confirmar pagamento, conceder/cancelar confiança e redefinir a senha quando necessário.
- A senha antiga nunca deve ser exibida.

## 11. Checklist rápido do Produtor

Antes de liberar:
- Nome da Loja correto;
- E-mail correto;
- WhatsApp correto;
- Plano e ciclo corretos;
- situação do pagamento conferida;
- decidir entre licença paga normal ou Confiança 72h.

Depois:
- licença correta;
- e-mail configurado/enviado;
- WhatsApp configurado/enviado;
- primeiro acesso disponível;
- troca de senha funcionando;
- configuração inicial concluída.

## 12. Regra operacional oficial

**Fluxo automático:** pagamento confirmado → criação/liberação → e-mail + WhatsApp → primeiro acesso → senha → configuração inicial → Dashboard.

**Fluxo manual/local:** Produtor cria/libera → e-mail + WhatsApp → senha inicial entregue diretamente → troca obrigatória → configuração inicial → Dashboard.

**Confiança 72h:** é somente uma liberação temporária controlada; nunca substitui a confirmação real de pagamento.
