(() => {
  'use strict';

  const state = {
    config: null,
    plans: [],
    selectedPlan: null,
    billingCycle: 'monthly',
    checkoutToken: '',
    order: null,
    pollingTimer: null
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    alert: $('checkout-alert'),
    plansGrid: $('plans-grid'),
    customerSection: $('customer-section'),
    form: $('checkout-form'),
    summary: $('checkout-summary'),
    submit: $('checkout-submit'),

    pixSection: $('pix-section'),
    pixQrCode: $('pix-qrcode'),
    pixCode: $('pix-code'),
    copyPix: $('copy-pix'),
    pixTicket: $('pix-ticket'),
    paymentStatusTitle: $('payment-status-title'),
    paymentStatusText: $('payment-status-text'),

    firstAccessSection: $('first-access-section'),
    firstAccessForm: $('first-access-form'),
    newPassword: $('newPassword')
  };

  function money(cents) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format((Number(cents) || 0) / 100);
  }

  function showAlert(message) {
    els.alert.textContent = message;
    els.alert.hidden = false;
    els.alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearAlert() {
    els.alert.hidden = true;
    els.alert.textContent = '';
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      const err = new Error(data.error || 'Nao foi possivel concluir a operacao.');
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  function getPlanAmount(plan) {
    if (!plan) return 0;

    return state.billingCycle === 'annual'
      ? Number(plan.annualAmountCents || 0)
      : Number(plan.monthlyAmountCents || 0);
  }

  function renderPlans() {
    els.plansGrid.innerHTML = '';

    if (!state.plans.length) {
      const empty = document.createElement('div');
      empty.className = 'loading-card';
      empty.textContent = 'Nenhum plano disponivel no momento.';
      els.plansGrid.appendChild(empty);
      return;
    }

    state.plans.forEach((plan, index) => {
      const card = document.createElement('article');
      card.className = 'plan-card';

      if (state.selectedPlan && state.selectedPlan.id === plan.id) {
        card.classList.add('selected');
      }

      const badge = document.createElement('span');
      badge.className = 'plan-badge';
      badge.textContent =
        index === 1 ? 'MAIS ESCOLHIDO' :
        state.billingCycle === 'annual' ? 'PLANO ANUAL' : 'PLANO MENSAL';

      const title = document.createElement('h2');
      title.className = 'plan-name';
      title.textContent = plan.name || plan.id;

      const price = document.createElement('div');
      price.className = 'plan-price';

      const strong = document.createElement('strong');
      strong.textContent = money(getPlanAmount(plan));

      const suffix = document.createElement('span');
      suffix.textContent = state.billingCycle === 'annual' ? '/ ano' : '/ mes';

      price.append(strong, suffix);

      const features = document.createElement('ul');
      features.className = 'plan-features';

      [
        'Loja individual no Provador Pro',
        'Painel administrativo da loja',
        'Catalogo, vitrine e provador integrados',
        'Suporte ao primeiro acesso'
      ].forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        features.appendChild(li);
      });

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'plan-select';
      button.textContent =
        state.selectedPlan && state.selectedPlan.id === plan.id
          ? 'Plano selecionado'
          : 'Escolher este plano';

      button.addEventListener('click', () => {
        selectPlan(plan.id);
      });

      card.append(badge, title, price, features, button);
      els.plansGrid.appendChild(card);
    });
  }

  function selectPlan(planId) {
    const plan = state.plans.find((item) => item.id === planId);
    if (!plan) return;

    state.selectedPlan = plan;

    renderPlans();
    renderSummary();

    els.customerSection.hidden = false;

    setTimeout(() => {
      els.customerSection.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 80);
  }

  function renderSummary() {
    if (!state.selectedPlan) {
      els.summary.innerHTML = '';
      return;
    }

    const cycleText =
      state.billingCycle === 'annual' ? 'Anual' : 'Mensal';

    const amount = getPlanAmount(state.selectedPlan);

    els.summary.innerHTML = '';

    const row1 = document.createElement('div');
    row1.className = 'summary-row';

    const label1 = document.createElement('span');
    label1.textContent = 'Plano';

    const value1 = document.createElement('strong');
    value1.textContent = state.selectedPlan.name;

    row1.append(label1, value1);

    const row2 = document.createElement('div');
    row2.className = 'summary-row';

    const label2 = document.createElement('span');
    label2.textContent = 'Cobranca';

    const value2 = document.createElement('strong');
    value2.textContent = cycleText;

    row2.append(label2, value2);

    const row3 = document.createElement('div');
    row3.className = 'summary-row';

    const label3 = document.createElement('span');
    label3.textContent = 'Total';

    const value3 = document.createElement('strong');
    value3.textContent = money(amount);

    row3.append(label3, value3);

    els.summary.append(row1, row2, row3);
  }

  function setupBillingButtons() {
    document.querySelectorAll('.billing-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const cycle = button.dataset.cycle;

        if (!['monthly', 'annual'].includes(cycle)) return;

        state.billingCycle = cycle;

        document.querySelectorAll('.billing-btn').forEach((item) => {
          item.classList.toggle('active', item === button);
        });

        renderPlans();
        renderSummary();
      });
    });
  }

  function setSubmitting(value) {
    els.submit.disabled = value;
    els.submit.textContent = value
      ? 'Gerando pagamento...'
      : 'Continuar para pagamento';
  }

  async function submitCheckout(event) {
    event.preventDefault();
    clearAlert();

    if (!state.selectedPlan) {
      showAlert('Escolha um plano antes de continuar.');
      return;
    }

    const buyerName = $('buyerName').value.trim();
    const buyerEmail = $('buyerEmail').value.trim().toLowerCase();
    const buyerPhone = $('buyerPhone').value.trim();
    const buyerCpfCnpj = $('buyerCpfCnpj').value.trim();
    const storeName = $('storeName').value.trim();

    if (!buyerName || !buyerEmail || !storeName) {
      showAlert('Preencha nome, e-mail e nome da loja.');
      return;
    }

    setSubmitting(true);

    try {
      const created = await api(
        '/api/public/checkout/producer/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            buyerName,
            buyerEmail,
            buyerPhone,
            buyerCpfCnpj,
            storeName,
            plan: state.selectedPlan.id,
            billingCycle: state.billingCycle,
            method: 'pix'
          })
        }
      );

      const order = created.order || {};

      if (!order.checkoutToken) {
        throw new Error('O pedido foi criado sem token de checkout.');
      }

      state.checkoutToken = order.checkoutToken;
      state.order = order;

      const attemptId =
        window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `pix-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const paid = await api(
        `/api/public/checkout/producer/orders/${encodeURIComponent(state.checkoutToken)}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({
            payerEmail: buyerEmail,
            identificationNumber: buyerCpfCnpj,
            attemptId
          })
        }
      );

      const payment = paid.payment || {};
      const pix = payment.pix || {};
      const returnedOrder = paid.order || order;
      const details = returnedOrder.paymentDetails || {};

      const qrCode =
        pix.qrCode ||
        pix.qr_code ||
        details.qrCode ||
        details.qr_code ||
        '';

      const qrBase64 =
        pix.qrCodeBase64 ||
        pix.qr_code_base64 ||
        details.qrCodeBase64 ||
        details.qr_code_base64 ||
        '';

      const ticketUrl =
        pix.ticketUrl ||
        pix.ticket_url ||
        details.ticketUrl ||
        details.ticket_url ||
        '';

      showPix({
        qrCode,
        qrBase64,
        ticketUrl
      });

      if (state.config && state.config.mode !== 'test') {
        startStatusPolling();
      } else {
        els.paymentStatusTitle.textContent = 'PIX gerado em ambiente de teste';
        els.paymentStatusText.textContent =
          'O pagamento de teste permanece pendente e nao libera uma loja real.';
      }

    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Nao foi possivel gerar o pagamento.');
    } finally {
      setSubmitting(false);
    }
  }

  function showPix({ qrCode, qrBase64, ticketUrl }) {
    els.pixCode.value = qrCode || '';

    if (qrBase64) {
      els.pixQrCode.src =
        qrBase64.startsWith('data:')
          ? qrBase64
          : `data:image/png;base64,${qrBase64}`;

      els.pixQrCode.hidden = false;
    } else {
      els.pixQrCode.hidden = true;
    }

    if (ticketUrl) {
      els.pixTicket.href = ticketUrl;
      els.pixTicket.hidden = false;
    } else {
      els.pixTicket.hidden = true;
    }

    els.pixSection.hidden = false;

    els.pixSection.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  async function copyPixCode() {
    const code = els.pixCode.value.trim();

    if (!code) {
      showAlert('Codigo PIX ainda nao disponivel.');
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      const original = els.copyPix.textContent;
      els.copyPix.textContent = 'Codigo copiado';

      setTimeout(() => {
        els.copyPix.textContent = original;
      }, 1800);
    } catch {
      els.pixCode.focus();
      els.pixCode.select();
      document.execCommand('copy');
    }
  }

  function startStatusPolling() {
    stopStatusPolling();

    checkPaymentStatus();

    state.pollingTimer = setInterval(() => {
      checkPaymentStatus();
    }, 8000);
  }

  function stopStatusPolling() {
    if (state.pollingTimer) {
      clearInterval(state.pollingTimer);
      state.pollingTimer = null;
    }
  }

  async function checkPaymentStatus() {
    if (!state.checkoutToken) return;

    try {
      const result = await api(
        `/api/public/checkout/producer/orders/${encodeURIComponent(state.checkoutToken)}/status`
      );

      const order = result.order || {};

      if (
        order.status === 'paid' ||
        result.confirmedPaid === true ||
        result.storeActivated === true
      ) {
        stopStatusPolling();

        els.paymentStatusTitle.textContent = 'Pagamento confirmado';
        els.paymentStatusText.textContent =
          'Sua loja foi liberada. Crie agora sua senha de acesso.';

        els.firstAccessSection.hidden = false;

        els.firstAccessSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }

    } catch (err) {
      console.warn('Consulta de pagamento:', err.message);
    }
  }

  async function submitFirstAccess(event) {
    event.preventDefault();
    clearAlert();

    if (!state.checkoutToken) {
      showAlert('Token de primeiro acesso nao encontrado.');
      return;
    }

    const newPassword = els.newPassword.value;

    try {
      const result = await api(
        `/api/public/checkout/producer/orders/${encodeURIComponent(state.checkoutToken)}/first-access-password`,
        {
          method: 'POST',
          body: JSON.stringify({ newPassword })
        }
      );

      const store = result.store || {};

      els.firstAccessForm.innerHTML = '';

      const success = document.createElement('div');
      success.className = 'checkout-summary';

      const title = document.createElement('strong');
      title.textContent = 'Senha criada com sucesso.';

      const text = document.createElement('p');
      text.textContent = 'Sua loja esta pronta para o primeiro acesso.';

      success.append(title, text);

      const link = document.createElement('a');
      link.className = 'primary-btn';
      link.style.display = 'grid';
      link.style.placeItems = 'center';
      link.style.textDecoration = 'none';
      link.style.marginTop = '15px';
      link.textContent = 'Entrar no painel da loja';

      const slug =
        store.slug ||
        result.slug ||
        '';

      link.href = slug
        ? `/login-loja.html?loja=${encodeURIComponent(slug)}`
        : '/login-loja.html';

      els.firstAccessForm.append(success, link);

    } catch (err) {
      console.error(err);
      showAlert(err.message || 'Nao foi possivel criar a senha.');
    }
  }

  async function loadConfig() {
    try {
      const config = await api('/api/public/checkout/config');

      state.config = config;

      state.plans = Array.isArray(config.producerPlans)
        ? config.producerPlans.filter((plan) => plan.active !== false && plan.enabled !== false)
        : [];

      if (
        !config.producerPayment ||
        config.producerPayment.configured !== true
      ) {
        showAlert('Pagamento temporariamente indisponivel.');
      }

      renderPlans();

    } catch (err) {
      console.error(err);
      els.plansGrid.innerHTML =
        '<div class="loading-card">Nao foi possivel carregar os planos.</div>';

      showAlert(err.message || 'Erro ao carregar checkout.');
    }
  }

  setupBillingButtons();

  els.form.addEventListener('submit', submitCheckout);
  els.copyPix.addEventListener('click', copyPixCode);
  els.firstAccessForm.addEventListener('submit', submitFirstAccess);

  loadConfig();

  window.addEventListener('beforeunload', stopStatusPolling);
})();
