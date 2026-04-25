LOJA SYSTEM PRO ONLINE

1. Instale Node.js 18+.
2. Rode npm install
3. Rode npm start
4. Abra http://localhost:10000

Login do produtor:
- usuário: produtor
- senha: 123456 (troque no deploy)

Esta versão usa SQLite local. Para produção no Render, configure DB_PATH em um caminho de disco persistente e defina BASE_URL com a URL pública do serviço.


PAGAMENTOS
- Mercado Pago: use como principal para Pix, cartão e boleto.
- Stripe: opcional/complementar.
- Veja também public/configuracao-cobranca.html


NOVO NESTA VERSÃO:
- Painel Financeiro com faturamento total, pendente e em atraso
- Criação manual de cobranças no painel
- Bloqueio automático da loja quando a licença vence e a cobrança segue em atraso
- TikTok adicionado no disparador de redes sociais
