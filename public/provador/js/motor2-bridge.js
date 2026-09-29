(() => {
  'use strict';

  const ROUTER_URL = 'http://127.0.0.1:8091/tryon/render';

  // A base LOCAL usa este slug.
  const LOCAL_TEST_STORE = 'loja-teste-a-local';

  // O Router ja possui override deste identificador para Motor 2.
  const ROUTER_STORE_ID = 'loja-teste-a';

  const TEST_LOOK = 'BLAZER ORIGINAL MOTOR 2';

  let resultUrl = '';
  let resultImg = null;
  let statusEl = null;
  let syncTimer = null;

  function currentSlug() {
    return (
      new URLSearchParams(location.search).get('loja') ||
      localStorage.getItem('loja_slug') ||
      ''
    ).trim().toLowerCase();
  }

  function lookName(item) {
    return String(item?.nome ?? item?.name ?? '').trim();
  }

  function shouldUse(item) {
    return currentSlug() === LOCAL_TEST_STORE &&
      lookName(item).toUpperCase() === TEST_LOOK;
  }

  function ensureStatus() {
    if (statusEl?.isConnected) return statusEl;

    statusEl = document.createElement('div');
    statusEl.id = 'motor2BridgeStatus';

    Object.assign(statusEl.style, {
      position: 'fixed',
      zIndex: '9998',
      padding: '9px 14px',
      borderRadius: '999px',
      fontFamily: 'Arial,sans-serif',
      fontWeight: '700',
      fontSize: '13px',
      pointerEvents: 'none',
      display: 'none',
      boxShadow: '0 4px 18px rgba(0,0,0,.28)'
    });

    document.body.appendChild(statusEl);
    return statusEl;
  }

  function syncGeometry() {
    const canvas = document.getElementById('poseCanvas');
    if (!canvas) return;

    const r = canvas.getBoundingClientRect();

    if (resultImg?.isConnected) {
      resultImg.style.left = `${r.left}px`;
      resultImg.style.top = `${r.top}px`;
      resultImg.style.width = `${r.width}px`;
      resultImg.style.height = `${r.height}px`;
    }

    if (statusEl?.isConnected) {
      const width = statusEl.getBoundingClientRect().width || 250;
      statusEl.style.left =
        `${Math.max(8, r.left + (r.width - width) / 2)}px`;
      statusEl.style.top = `${Math.max(8, r.top + 12)}px`;
    }
  }

  function setStatus(text, kind = 'info') {
    const el = ensureStatus();

    el.textContent = text;
    el.style.display = 'block';
    el.style.background =
      kind === 'error' ? '#b42318' :
      kind === 'ok' ? '#087443' :
      '#16181d';
    el.style.color = '#fff';

    syncGeometry();
  }

  function ensureResultImage() {
    if (resultImg?.isConnected) return resultImg;

    resultImg = document.createElement('img');
    resultImg.id = 'motor2BridgeResult';
    resultImg.alt = 'Render do Motor 2';

    Object.assign(resultImg.style, {
      position: 'fixed',
      zIndex: '4',
      objectFit: 'contain',
      pointerEvents: 'none',
      display: 'none',
      background: '#000'
    });

    document.body.appendChild(resultImg);

    if (!syncTimer) {
      syncTimer = window.setInterval(syncGeometry, 250);
      window.addEventListener('resize', syncGeometry, { passive: true });
      window.addEventListener('scroll', syncGeometry, { passive: true });
    }

    return resultImg;
  }

  function clearResult() {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      resultUrl = '';
    }

    if (resultImg) {
      resultImg.removeAttribute('src');
      resultImg.style.display = 'none';
    }

    if (statusEl) {
      statusEl.style.display = 'none';
    }
  }

  function waitForVideo(video, timeoutMs = 10000) {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const started = Date.now();

      const timer = setInterval(() => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          clearInterval(timer);
          resolve();
        } else if (Date.now() - started > timeoutMs) {
          clearInterval(timer);
          reject(new Error('Camera sem quadro valido.'));
        }
      }, 100);
    });
  }

  async function capturePersonBlob() {
    const video = document.getElementById('video');

    if (!video) {
      throw new Error('Elemento de video nao encontrado.');
    }

    await waitForVideo(video);

    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;

    const ctx = c.getContext('2d');

    // Mantem a mesma orientacao visual espelhada do Provador atual.
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, c.width, c.height);

    return new Promise((resolve, reject) => {
      c.toBlob(
        blob => blob
          ? resolve(blob)
          : reject(new Error('Falha ao capturar pessoa.')),
        'image/png',
        0.95
      );
    });
  }

  async function garmentBlob(src) {
    if (!src) {
      throw new Error('Imagem da roupa nao encontrada.');
    }

    const response = await fetch(src, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(
        `Falha ao carregar roupa: HTTP ${response.status}`
      );
    }

    return response.blob();
  }

  async function tryOn(item) {
    clearResult();

    if (window.CameraModule) {
      CameraModule.overlayImg = null;
    }

    setStatus('MOTOR 2 - CAPTURANDO PESSOA...');

    try {
      const [person, garment] = await Promise.all([
        capturePersonBlob(),
        garmentBlob(item.imagem)
      ]);

      const form = new FormData();

      form.append('person', person, 'person.png');
      form.append(
        'garment',
        garment,
        'garment' + (
          garment.type === 'image/png'
            ? '.png'
            : '.jpg'
        )
      );
      form.append('category', 'tops');

      setStatus('ROUTER 8090 - PROCESSANDO BLAZER...');

      const controller = new AbortController();
      const timeout =
        setTimeout(() => controller.abort(), 185000);

      let response;

      try {
        response = await fetch(ROUTER_URL, {
          method: 'POST',
          headers: {
            'X-Provador-Store': ROUTER_STORE_ID,
            'X-Provador-Request-Id':
              `teste-a-local-${Date.now()}`
          },
          body: form,
          cache: 'no-store',
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const contentType =
        response.headers.get('content-type') || '';

      if (!response.ok) {
        const detail =
          await response.text().catch(() => '');

        throw new Error(
          `Router respondeu HTTP ${response.status}` +
          (detail
            ? `: ${detail.slice(0, 240)}`
            : '')
        );
      }

      if (
        !contentType
          .toLowerCase()
          .includes('image/')
      ) {
        throw new Error(
          `Resposta inesperada do Router: ${
            contentType || 'sem Content-Type'
          }`
        );
      }

      const blob = await response.blob();

      resultUrl = URL.createObjectURL(blob);

      const img = ensureResultImage();

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () =>
          reject(
            new Error(
              'PNG retornado nao pode ser exibido.'
            )
          );
        img.src = resultUrl;
      });

      img.style.display = 'block';
      syncGeometry();

      setStatus(
        'ROUTER 8090 - RENDER MOTOR 2 RECEBIDO',
        'ok'
      );

      console.log(
        '[Motor2Bridge] render recebido',
        {
          localStore: LOCAL_TEST_STORE,
          routerStore: ROUTER_STORE_ID,
          look: lookName(item),
          type: blob.type,
          bytes: blob.size
        }
      );

      return true;
    } catch (error) {
      console.error(
        '[Motor2Bridge] falha',
        error
      );

      setStatus(
        'MOTOR 2 NAO RESPONDEU - OVERLAY ANTIGO ATIVADO',
        'error'
      );

      if (window.CameraModule) {
        CameraModule.setLook(item.imagem);
      }

      return false;
    }
  }

  window.Motor2Bridge = {
    shouldUse,
    tryOn,
    clear: clearResult,
    getLocalTestStore:
      () => LOCAL_TEST_STORE,
    getRouterStore:
      () => ROUTER_STORE_ID,
    getTestLook:
      () => TEST_LOOK
  };
})();
