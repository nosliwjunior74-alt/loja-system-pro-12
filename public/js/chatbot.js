const respostasBot = [
  {
    pergunta: "Como usar o provador?",
    resposta: "Abra o provador, permita a câmera e clique em um look para vestir no corpo."
  },
  {
    pergunta: "Como cadastrar roupa?",
    resposta: "Vá em Estoque, clique em adicionar roupa, coloque nome, categoria, preço e imagem."
  },
  {
    pergunta: "Como trocar look?",
    resposta: "No provador, clique na roupa no painel lateral em Looks."
  },
  {
    pergunta: "Como abrir a loja no celular?",
    resposta: "Use o link da loja no formato /s/nome-da-loja ou gere um QR Code."
  },
  {
    pergunta: "Como resolver loja não encontrada?",
    resposta: "Confira se está usando o domínio correto e se a loja foi cadastrada com o slug certo."
  }
];

function abrirChatbot(){
  document.getElementById("chatbotBox").style.display = "flex";
}

function fecharChatbot(){
  document.getElementById("chatbotBox").style.display = "none";
}

function responderBot(texto){
  const chat = document.getElementById("chatbotMensagens");

  chat.innerHTML += `<div class="msg user">${texto}</div>`;

  const item = respostasBot.find(r =>
    r.pergunta.toLowerCase().includes(texto.toLowerCase()) ||
    texto.toLowerCase().includes(r.pergunta.toLowerCase().replace("como ",""))
  );

  const resposta = item ? item.resposta : "Não encontrei essa resposta ainda. Cadastre essa pergunta no painel de suporte.";

  chat.innerHTML += `<div class="msg bot">${resposta}</div>`;
  chat.scrollTop = chat.scrollHeight;
}

function enviarPerguntaBot(){
  const input = document.getElementById("chatbotInput");
  const texto = input.value.trim();
  if(!texto) return;
  input.value = "";
  responderBot(texto);
}

function montarChatbot(){
  const html = `
    <button id="chatbotBtn" onclick="abrirChatbot()">💬 Ajuda</button>

    <div id="chatbotBox">
      <div class="chatbotHeader">
        <strong>Assistente Virtual</strong>
        <button onclick="fecharChatbot()">×</button>
      </div>

      <div id="chatbotMensagens">
        <div class="msg bot">Olá! Como posso ajudar?</div>
        ${respostasBot.map(r => `<button class="quick" onclick="responderBot('${r.pergunta}')">${r.pergunta}</button>`).join("")}
      </div>

      <div class="chatbotFooter">
        <input id="chatbotInput" placeholder="Digite sua dúvida...">
        <button onclick="enviarPerguntaBot()">Enviar</button>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
}

window.addEventListener("load", montarChatbot);
