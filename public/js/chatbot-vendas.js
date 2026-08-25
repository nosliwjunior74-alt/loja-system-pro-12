(() => {
  "use strict";

  const estado = {
    slug: "",
    store: null,
    support: null
  };

  function obterSlug() {
    const params = new URLSearchParams(window.location.search);

    return (
      params.get("loja") ||
      params.get("slug") ||
      localStorage.getItem("loja_slug") ||
      ""
    );
  }

  function limparTelefone(valor) {
    return String(valor || "").replace(/\D/g, "");
  }

  function normalizar(valor) {
    return String(valor || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function lerSupportConfig(store) {
    const cfg =
      store &&
      store.supportConfig &&
      typeof store.supportConfig === "object"
        ? store.supportConfig
        : {};

    return {
      chatTitle:
        String(cfg.chatTitle || "").trim() ||
        "Atendimento da Loja",

      greeting:
        String(cfg.greeting || "").trim() ||
        "Olá! Seja bem-vindo(a). Como podemos ajudar?",

      purchaseMessage:
        String(cfg.purchaseMessage || "").trim() ||
        "Olá! Tenho interesse em um produto da loja:",

      address:
        String(cfg.address || "").trim(),

      hours:
        String(cfg.hours || "").trim(),

      chatEnabled:
        cfg.chatEnabled !== false,

      quickReplies:
        Array.isArray(cfg.quickReplies)
          ? cfg.quickReplies.filter(
              item =>
                item &&
                String(item.question || "").trim()
            )
          : []
    };
  }

  function montarWhatsAppUrl(mensagem) {
    const telefone = limparTelefone(
      estado.store?.phone
    );

    const texto = encodeURIComponent(
      String(
        mensagem ||
        estado.support?.purchaseMessage ||
        estado.support?.greeting ||
        "Olá!"
      )
    );

    if (telefone) {
      return `https://wa.me/${telefone}?text=${texto}`;
    }

    return `https://wa.me/?text=${texto}`;
  }

  function abrirWhatsApp(mensagem) {
    window.open(
      montarWhatsAppUrl(mensagem),
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function carregarLoja() {
    estado.slug = obterSlug();

    if (!estado.slug) {
      throw new Error("Loja não encontrada na URL.");
    }

    const resposta = await fetch(
      `/api/public/store/${encodeURIComponent(estado.slug)}`,
      { cache: "no-store" }
    );

    const dados = await resposta
      .json()
      .catch(() => ({}));

    if (!resposta.ok || !dados.store) {
      throw new Error(
        dados.error ||
        "Não foi possível carregar a loja."
      );
    }

    estado.store = dados.store;
    estado.support = lerSupportConfig(dados.store);
  }

  function instalarEstilos() {
    if (document.getElementById("chatVendasStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "chatVendasStyles";

    style.textContent = `
      #chatVendaOverlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.35);
        z-index: 99998;
      }

      #chatVendaOverlay.aberto {
        display: block;
      }

      #chatVendaBox {
        display: none;
        position: fixed;
        right: 20px;
        bottom: 20px;
        width: min(390px, calc(100vw - 30px));
        max-height: calc(100vh - 40px);
        background: white;
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,.28);
        z-index: 99999;
        overflow: hidden;
        font-family: Arial, sans-serif;
        flex-direction: column;
      }

      #chatVendaBox.aberto {
        display: flex;
      }

      .chat-venda-header {
        background: linear-gradient(135deg,#e83e9f,#7c3aed);
        color: white;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .chat-venda-header strong {
        font-size: 17px;
      }

      .chat-venda-fechar {
        border: 0;
        background: rgba(255,255,255,.2);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
      }

      #chatVendaMensagens {
        padding: 15px;
        background: #fff7fb;
        overflow-y: auto;
        min-height: 220px;
        max-height: 430px;
      }

      .chat-venda-msg {
        padding: 11px 13px;
        border-radius: 14px;
        margin-bottom: 10px;
        max-width: 86%;
        font-size: 14px;
        line-height: 1.4;
        white-space: pre-wrap;
      }

      .chat-venda-msg.bot {
        background: white;
        border: 1px solid #f1d4e4;
      }

      .chat-venda-msg.user {
        background: #e83e9f;
        color: white;
        margin-left: auto;
      }

      .chat-venda-info {
        background: white;
        border: 1px solid #f1d4e4;
        border-radius: 12px;
        padding: 10px;
        margin-bottom: 12px;
        font-size: 13px;
        white-space: pre-wrap;
      }

      #chatVendaQuickReplies {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 10px;
      }

      .chat-venda-quick {
        border: 1px solid #e83e9f;
        background: white;
        color: #a01865;
        border-radius: 20px;
        padding: 8px 10px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
      }

      .chat-venda-footer {
        display: flex;
        gap: 8px;
        padding: 11px;
        border-top: 1px solid #f1d4e4;
      }

      #chatVendaInput {
        flex: 1;
        min-width: 0;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 10px;
      }

      #chatVendaEnviar {
        border: 0;
        background: #e83e9f;
        color: white;
        border-radius: 10px;
        padding: 10px 14px;
        font-weight: bold;
        cursor: pointer;
      }

      #chatVendaWhatsApp {
        border: 0;
        width: 100%;
        padding: 13px;
        background: #16a34a;
        color: white;
        font-weight: bold;
        cursor: pointer;
      }

      @media(max-width:600px) {
        #chatVendaBox {
          right: 10px;
          left: 10px;
          top: 10px;
          bottom: 10px;
          width: auto;
          height: auto;
          max-height: none;
        }

        #chatVendaMensagens {
          flex: 1 1 auto;
          min-height: 0;
          max-height: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function adicionarMensagem(tipo, texto) {
    const area =
      document.getElementById("chatVendaMensagens");

    if (!area) return;

    const msg = document.createElement("div");

    msg.className = `chat-venda-msg ${tipo}`;
    msg.textContent = String(texto || "");

    area.appendChild(msg);
    area.scrollTop = area.scrollHeight;
  }

  function localizarResposta(pergunta) {
    const busca = normalizar(pergunta);

    return (
      estado.support.quickReplies.find(item => {
        const configurada = normalizar(
          item.question
        );

        return (
          configurada === busca ||
          configurada.includes(busca) ||
          busca.includes(configurada)
        );
      }) || null
    );
  }

  async function consultarIa(pergunta) {
    try {
      const resposta = await fetch(
        "/api/public/ai-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            slug: estado.slug,
            message: String(pergunta || "").trim()
          })
        }
      );

      const dados = await resposta
        .json()
        .catch(() => ({}));

      if (
        resposta.ok &&
        typeof dados.answer === "string" &&
        dados.answer.trim()
      ) {
        return {
          ok: true,
          answer: dados.answer.trim()
        };
      }

      return {
        ok: false,
        fallback: dados.fallback !== false,
        error: String(dados.error || "")
      };

    } catch (erro) {
      console.warn(
        "[Atendimento IA] fallback:",
        erro
      );

      return {
        ok: false,
        fallback: true,
        error: String(
          erro?.message || ""
        )
      };
    }
  }


  async function responder(pergunta) {
    const texto = String(pergunta || "").trim();

    if (!texto) return;

    adicionarMensagem("user", texto);

    const ia = await consultarIa(texto);

    if (ia.ok) {
      adicionarMensagem(
        "bot",
        ia.answer
      );

      return;
    }

    const resposta = localizarResposta(texto);

    if (resposta) {
      adicionarMensagem(
        "bot",
        resposta.answer ||
        "Fale conosco pelo WhatsApp."
      );

      return;
    }

    const normal = normalizar(texto);

    if (
      normal.includes("comprar") ||
      normal.includes("vendedor") ||
      normal.includes("whatsapp")
    ) {
      adicionarMensagem(
        "bot",
        "Vou abrir o WhatsApp da loja para continuar seu atendimento."
      );

      setTimeout(() => {
        abrirWhatsApp(
          estado.support.purchaseMessage
        );
      }, 300);

      return;
    }

    adicionarMensagem(
      "bot",
      "Escolha uma das opcoes de atendimento abaixo ou fale conosco pelo WhatsApp."
    );
  }

  function renderizarRespostasRapidas() {
    const area =
      document.getElementById("chatVendaQuickReplies");

    if (!area) return;

    area.innerHTML = "";

    estado.support.quickReplies.forEach(item => {
      const pergunta =
        String(item.question || "").trim();

      if (!pergunta) return;

      const botao =
        document.createElement("button");

      botao.type = "button";
      botao.className = "chat-venda-quick";
      botao.textContent = pergunta;

      botao.addEventListener("click", () => {
        responder(pergunta);
      });

      area.appendChild(botao);
    });
  }

  function fecharChat() {
    document
      .getElementById("chatVendaBox")
      ?.classList.remove("aberto");

    document
      .getElementById("chatVendaOverlay")
      ?.classList.remove("aberto");
  }

  function abrirChat() {
    if (!estado.support.chatEnabled) {
      abrirWhatsApp(
        estado.support.greeting
      );

      return;
    }

    document
      .getElementById("chatVendaBox")
      ?.classList.add("aberto");

    document
      .getElementById("chatVendaOverlay")
      ?.classList.add("aberto");
  }

  function montarChat() {
    const overlay =
      document.createElement("div");

    overlay.id = "chatVendaOverlay";

    const box =
      document.createElement("div");

    box.id = "chatVendaBox";

    box.innerHTML = `
      <div class="chat-venda-header">
        <strong id="chatVendaTitulo"></strong>
        <button
          type="button"
          class="chat-venda-fechar"
          id="chatVendaFechar"
        >×</button>
      </div>

      <div id="chatVendaMensagens">
        <div class="chat-venda-msg bot" id="chatVendaSaudacao"></div>
        <div class="chat-venda-info" id="chatVendaInfo"></div>
        <div id="chatVendaQuickReplies"></div>
      </div>

      <div class="chat-venda-footer">
        <input
          id="chatVendaInput"
          type="text"
          placeholder="Digite sua dúvida..."
        >

        <button
          id="chatVendaEnviar"
          type="button"
        >
          Enviar
        </button>
      </div>

      <button
        id="chatVendaWhatsApp"
        type="button"
      >
        💬 Continuar pelo WhatsApp
      </button>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(box);

    document.getElementById(
      "chatVendaTitulo"
    ).textContent =
      estado.support.chatTitle;

    document.getElementById(
      "chatVendaSaudacao"
    ).textContent =
      estado.support.greeting;

    const infos = [];

    if (estado.support.address) {
      infos.push(
        `📍 ${estado.support.address}`
      );
    }

    if (estado.support.hours) {
      infos.push(
        `🕒 ${estado.support.hours}`
      );
    }

    const info =
      document.getElementById("chatVendaInfo");

    if (infos.length) {
      info.textContent = infos.join("\n");
    } else {
      info.style.display = "none";
    }

    renderizarRespostasRapidas();

    document
      .getElementById("chatVendaFechar")
      .addEventListener("click", fecharChat);

    overlay.addEventListener(
      "click",
      fecharChat
    );

    const input =
      document.getElementById("chatVendaInput");

    const enviar =
      document.getElementById("chatVendaEnviar");

    enviar.addEventListener("click", () => {
      responder(input.value);
      input.value = "";
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        enviar.click();
      }
    });

    document
      .getElementById("chatVendaWhatsApp")
      .addEventListener("click", () => {
        abrirWhatsApp(
          estado.support.purchaseMessage
        );
      });
  }

  function ligarBotoesDaLoja() {
    const btnWhats =
      document.getElementById("btnWhats");

    if (btnWhats) {
      btnWhats.href = "#atendimento";
      btnWhats.removeAttribute("target");

      btnWhats.addEventListener(
        "click",
        event => {
          event.preventDefault();
          abrirChat();
        }
      );
    }

    const whatsFixo =
      document.getElementById("whatsFixo");

    if (whatsFixo) {
      whatsFixo.href =
        montarWhatsAppUrl(
          estado.support.purchaseMessage
        );

      whatsFixo.target = "_blank";
      whatsFixo.rel =
        "noopener noreferrer";
    }
  }

  async function iniciar() {
    try {
      await carregarLoja();

      instalarEstilos();
      montarChat();
      ligarBotoesDaLoja();

      window.ProvadorSalesSupport = {
        openChat: abrirChat,
        openWhatsApp: abrirWhatsApp,
        buildWhatsAppUrl: montarWhatsAppUrl,
        getStore: () => estado.store,
        getSupportConfig: () => estado.support
      };

      console.log(
        "[Atendimento] Loja carregada:",
        estado.store.name,
        estado.support
      );
    } catch (erro) {
      console.error(
        "[Atendimento] Erro:",
        erro
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      iniciar
    );
  } else {
    iniciar();
  }
})();