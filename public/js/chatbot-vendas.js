const numeroVendedor = "5531999999999"; // troque pelo WhatsApp da loja

function abrirChatVendas(){
  document.getElementById("chatVendasBox").style.display = "flex";
}

function fecharChatVendas(){
  document.getElementById("chatVendasBox").style.display = "none";
}

function msgVendas(texto, tipo="bot"){
  const area = document.getElementById("chatVendasMensagens");
  area.innerHTML += `<div class="msg ${tipo}">${texto}</div>`;
  area.scrollTop = area.scrollHeight;
}

function responderVenda(tipo){
  if(tipo === "looks"){
    msgVendas("Temos looks disponíveis no provador. Clique em uma peça no painel de looks para experimentar.");
  }

  if(tipo === "tamanho"){
    msgVendas("Você pode informar seu tamanho aproximado ao vendedor. Exemplo: P, M, G ou 38, 40, 42.");
  }

  if(tipo === "comprar"){
    msgVendas("Para comprar, clique em 'Falar com vendedor' e envie o look escolhido pelo WhatsApp.");
  }

  if(tipo === "entrega"){
    msgVendas("A entrega e retirada são combinadas diretamente com a loja pelo WhatsApp.");
  }

  if(tipo === "vendedor"){
    const texto = encodeURIComponent("Olá! Vi um look no provador virtual e quero atendimento.");
    window.open(`https://wa.me/${numeroVendedor}?text=${texto}`, "_blank");
  }
}

function montarChatVendas(){
  const html = `
    <button id="chatVendasBtn" onclick="abrirChatVendas()">🛍️ Comprar</button>

    <div id="chatVendasBox">
      <div class="chatbotHeader">
        <strong>Assistente de Vendas</strong>
        <button onclick="fecharChatVendas()">×</button>
      </div>

      <div id="chatVendasMensagens">
        <div class="msg bot">Olá! Posso te ajudar a escolher e comprar seu look.</div>

        <button class="quick" onclick="responderVenda('looks')">👗 Ver looks disponíveis</button>
        <button class="quick" onclick="responderVenda('tamanho')">📏 Dúvida sobre tamanho</button>
        <button class="quick" onclick="responderVenda('comprar')">💳 Como comprar</button>
        <button class="quick" onclick="responderVenda('entrega')">🚚 Entrega</button>
        <button class="quick" onclick="responderVenda('vendedor')">📲 Falar com vendedor</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
}

window.addEventListener("load", montarChatVendas);
