const whatsappVendedor = "5531999999999"; // troque pelo WhatsApp da loja

function botResposta(pergunta){
  const texto = pergunta.toLowerCase();

  if(texto.includes("vestido")){
    return `
👗 Temos vestidos disponíveis.

Deseja:
1 - Ver catálogo
2 - Falar com vendedor
3 - Testar no provador
`;
  }

  if(texto.includes("blusa") || texto.includes("camisa")){
    return `
👚 Temos blusas e camisas disponíveis.

Deseja:
1 - Ver looks disponíveis
2 - Saber tamanhos
3 - Falar com vendedor
`;
  }

  if(texto.includes("calça") || texto.includes("calca")){
    return `
👖 Temos calças disponíveis.

Deseja:
1 - Ver catálogo
2 - Conferir tamanho
3 - Falar com vendedor
`;
  }

  if(texto.includes("preço") || texto.includes("valor")){
    return "💰 Os preços aparecem no catálogo. Para desconto ou reserva, fale com o vendedor.";
  }

  if(texto.includes("tamanho")){
    return "📏 Temos tamanhos P, M, G e numerações. Informe seu tamanho para o vendedor confirmar disponibilidade.";
  }

  if(texto.includes("entrega")){
    return "🚚 A entrega ou retirada é combinada diretamente com a loja pelo WhatsApp.";
  }

  if(texto.includes("comprar") || texto.includes("vendedor")){
    abrirWhatsapp();
    return "📲 Vou te encaminhar para o vendedor finalizar sua compra.";
  }

  if(texto === "1"){
    return "🛍 Clique em Catálogo ou Vitrine / Provador para ver os looks disponíveis.";
  }

  if(texto === "2"){
    abrirWhatsapp();
    return "📲 Chamando vendedor para atendimento.";
  }

  if(texto === "3"){
    return "👗 Clique em Vitrine / Provador e escolha uma roupa para testar.";
  }

  return `
Posso te ajudar com:
👗 vestido
👚 blusa
👖 calça
💰 preço
📏 tamanho
🚚 entrega
💬 comprar
`;
}

function abrirWhatsapp(){
  const mensagem = encodeURIComponent("Olá! Vim pelo provador virtual e quero comprar uma roupa.");
  window.open(`https://wa.me/${whatsappVendedor}?text=${mensagem}`, "_blank");
}

function enviarVenda(){
  const input = document.getElementById("chatVendaInput");
  const mensagens = document.getElementById("chatVendaMensagens");
  const pergunta = input.value.trim();

  if(!pergunta) return;

  mensagens.innerHTML += `<div class="msg user">${pergunta}</div>`;
  mensagens.innerHTML += `<div class="msg bot">${botResposta(pergunta)}</div>`;

  input.value = "";
  mensagens.scrollTop = mensagens.scrollHeight;
}

function montarChatVenda(){
  const html = `
    <button id="chatVendaBtn" onclick="document.getElementById('chatVendaBox').style.display='block'">
      🛍 Comprar
    </button>

    <div id="chatVendaBox">
      <div class="chatbotHeader">
        <strong>Assistente de Vendas</strong>
        <button onclick="document.getElementById('chatVendaBox').style.display='none'">×</button>
      </div>

      <div id="chatVendaMensagens">
        <div class="msg bot">
          👋 Olá, seja bem-vindo!<br>
          Como podemos ajudar?<br><br>
          🛍 Ver promoções<br>
          👗 Testar provador<br>
          📦 Acompanhar pedido<br>
          💬 Falar com vendedor
        </div>
      </div>

      <div class="chatbotFooter">
        <input id="chatVendaInput" placeholder="Ex: tem vestido preto?">
        <button onclick="enviarVenda()">Enviar</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
}

window.addEventListener("load", montarChatVenda);
