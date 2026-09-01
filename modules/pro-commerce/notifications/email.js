'use strict';

const nodemailer = require('nodemailer');

const SMTP_HOST = String(process.env.PRO_SMTP_HOST || '').trim();
const SMTP_PORT = Number(process.env.PRO_SMTP_PORT || 587);
const SMTP_SECURE =
  String(process.env.PRO_SMTP_SECURE || '').trim().toLowerCase() === 'true' ||
  SMTP_PORT === 465;

const SMTP_USER = String(process.env.PRO_SMTP_USER || '').trim();
const SMTP_PASS = String(process.env.PRO_SMTP_PASS || '');
const EMAIL_FROM = String(process.env.PRO_EMAIL_FROM || '').trim();
const EMAIL_REPLY_TO = String(process.env.PRO_EMAIL_REPLY_TO || '').trim();
const DEFAULT_BRAND =
  String(process.env.PRO_EMAIL_BRAND_NAME || 'Provador Pro System').trim();

let transporter = null;

function isEmailConfigured() {
  return Boolean(
    SMTP_HOST &&
    SMTP_PORT &&
    SMTP_USER &&
    SMTP_PASS &&
    EMAIL_FROM
  );
}

function getEmailConfigStatus() {
  return {
    configured: isEmailConfigured(),
    hostConfigured: Boolean(SMTP_HOST),
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    userConfigured: Boolean(SMTP_USER),
    passwordConfigured: Boolean(SMTP_PASS),
    fromConfigured: Boolean(EMAIL_FROM)
  };
}

function getTransporter() {
  if (!isEmailConfigured()) {
    throw new Error('Envio de e-mail nao configurado no servidor.');
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
  }

  return transporter;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMoney(cents) {
  return (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function billingCycleLabel(value) {
  return value === 'annual' ? 'Anual' : 'Mensal';
}

function buildActivationEmail(data = {}) {
  const brandName =
    String(data.brandName || DEFAULT_BRAND || 'Provador Pro System').trim();

  const recipientName =
    String(data.recipientName || 'Cliente').trim();

  const storeName =
    String(data.storeName || '').trim();

  const plan =
    String(data.plan || '').trim();

  const billingCycle =
    billingCycleLabel(data.billingCycle);

  const amount =
    formatMoney(data.amountCents);

  const firstAccessUrl =
    String(data.firstAccessUrl || '').trim();

  const safeBrand = escapeHtml(brandName);
  const safeName = escapeHtml(recipientName);
  const safeStore = escapeHtml(storeName);
  const safePlan = escapeHtml(plan);
  const safeCycle = escapeHtml(billingCycle);
  const safeAmount = escapeHtml(amount);
  const safeUrl = escapeHtml(firstAccessUrl);

  const subject =
    `${brandName} - pagamento confirmado e loja ativada`;

  const text = [
    `Olá, ${recipientName}!`,
    '',
    'Seu pagamento foi confirmado com sucesso.',
    `Loja: ${storeName}`,
    `Plano: ${plan}`,
    `Ciclo: ${billingCycle}`,
    `Valor: ${amount}`,
    '',
    'Sua loja já foi ativada.',
    '',
    'Para concluir o primeiro acesso e criar sua senha, utilize o link seguro abaixo:',
    firstAccessUrl,
    '',
    'Por segurança, nenhuma senha é enviada por e-mail.',
    '',
    `Equipe ${brandName}`
  ].join('\n');

  const html = `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,sans-serif;color:#222;">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.07);">

      <h1 style="margin:0 0 20px;font-size:24px;">
        Pagamento confirmado
      </h1>

      <p>Olá, <strong>${safeName}</strong>!</p>

      <p>
        Seu pagamento foi confirmado e sua loja
        <strong>${safeStore}</strong> já foi ativada.
      </p>

      <div style="background:#faf4f7;border-radius:12px;padding:18px;margin:22px 0;">
        <p style="margin:4px 0;"><strong>Plano:</strong> ${safePlan}</p>
        <p style="margin:4px 0;"><strong>Ciclo:</strong> ${safeCycle}</p>
        <p style="margin:4px 0;"><strong>Valor:</strong> ${safeAmount}</p>
      </div>

      <p>
        Para concluir seu primeiro acesso e criar sua senha,
        clique no botão abaixo:
      </p>

      <p style="margin:28px 0;text-align:center;">
        <a
          href="${safeUrl}"
          style="display:inline-block;padding:14px 24px;border-radius:10px;background:#c44577;color:#ffffff;text-decoration:none;font-weight:bold;"
        >
          Criar senha e acessar minha loja
        </a>
      </p>

      <p style="font-size:13px;color:#666;">
        Por segurança, nenhuma senha é enviada por e-mail ou WhatsApp.
      </p>

      <p style="margin-top:28px;">
        Equipe ${safeBrand}
      </p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    text,
    html
  };
}

async function sendActivationEmail(data = {}) {
  const to = String(data.to || '').trim().toLowerCase();
  const firstAccessUrl = String(data.firstAccessUrl || '').trim();

  if (!to) {
    return {
      ok: false,
      error: 'E-mail do cliente nao informado.'
    };
  }

  if (!firstAccessUrl) {
    return {
      ok: false,
      error: 'Link de primeiro acesso nao informado.'
    };
  }

  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: 'Envio de e-mail nao configurado no servidor.'
    };
  }

  try {
    const message = buildActivationEmail(data);

    const info = await getTransporter().sendMail({
      from: EMAIL_FROM,
      to,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    return {
      ok: true,
      messageId: String(info.messageId || ''),
      accepted: Array.isArray(info.accepted)
        ? info.accepted.map(String)
        : []
    };
  } catch (err) {
    return {
      ok: false,
      error: String(
        err?.message ||
        'Falha ao enviar e-mail de ativacao.'
      )
    };
  }
}


function buildManualWelcomeEmail(data = {}) {
  const brandName =
    String(data.brandName || DEFAULT_BRAND || 'Provador Pro System').trim();

  const recipientName =
    String(data.recipientName || 'Cliente').trim();

  const storeName =
    String(data.storeName || '').trim();

  const plan =
    String(data.plan || '').trim();

  const loginUrl =
    String(data.loginUrl || '').trim();

  const safeBrand = escapeHtml(brandName);
  const safeName = escapeHtml(recipientName);
  const safeStore = escapeHtml(storeName);
  const safePlan = escapeHtml(plan);
  const safeUrl = escapeHtml(loginUrl);

  const subject =
    `${brandName} - sua loja está pronta para o primeiro acesso`;

  const text = [
    `Olá, ${recipientName}!`,
    '',
    `Sua loja ${storeName} foi criada e liberada no ${brandName}.`,
    plan ? `Plano: ${plan}` : '',
    '',
    'Use o link abaixo para acessar sua loja:',
    loginUrl,
    '',
    'Utilize a senha inicial informada pelo administrador.',
    'No primeiro login, o sistema solicitará a criação de uma nova senha.',
    '',
    'Por segurança, nenhuma senha é enviada por e-mail ou WhatsApp.',
    '',
    `Equipe ${brandName}`
  ].filter(Boolean).join('\n');

  const html = `
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,sans-serif;color:#222;">
  <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
    <div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.07);">
      <h1 style="margin:0 0 20px;font-size:24px;">Bem-vindo ao ${safeBrand}</h1>
      <p>Olá, <strong>${safeName}</strong>!</p>
      <p>Sua loja <strong>${safeStore}</strong> foi criada e liberada.</p>
      ${safePlan ? `<p><strong>Plano:</strong> ${safePlan}</p>` : ''}
      <p>
        Use o botão abaixo para fazer seu primeiro acesso.
        Utilize a senha inicial informada pelo administrador.
        No primeiro login, o sistema solicitará a criação de uma nova senha.
      </p>
      <p style="margin:28px 0;text-align:center;">
        <a
          href="${safeUrl}"
          style="display:inline-block;padding:14px 24px;border-radius:10px;background:#c44577;color:#ffffff;text-decoration:none;font-weight:bold;"
        >
          Acessar minha loja
        </a>
      </p>
      <p style="font-size:13px;color:#666;">
        Por segurança, nenhuma senha é enviada por e-mail ou WhatsApp.
      </p>
      <p style="margin-top:28px;">Equipe ${safeBrand}</p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject,
    text,
    html
  };
}

async function sendManualWelcomeEmail(data = {}) {
  const to = String(data.to || '').trim().toLowerCase();
  const loginUrl = String(data.loginUrl || '').trim();

  if (!to) {
    return {
      ok: false,
      error: 'E-mail do cliente nao informado.'
    };
  }

  if (!loginUrl) {
    return {
      ok: false,
      error: 'Link de acesso da loja nao informado.'
    };
  }

  if (!isEmailConfigured()) {
    return {
      ok: false,
      error: 'Envio de e-mail nao configurado no servidor.'
    };
  }

  try {
    const message = buildManualWelcomeEmail(data);

    const info = await getTransporter().sendMail({
      from: EMAIL_FROM,
      to,
      replyTo: EMAIL_REPLY_TO || undefined,
      subject: message.subject,
      text: message.text,
      html: message.html
    });

    return {
      ok: true,
      messageId: String(info.messageId || ''),
      accepted: Array.isArray(info.accepted)
        ? info.accepted.map(String)
        : []
    };
  } catch (err) {
    return {
      ok: false,
      error: String(
        err?.message ||
        'Falha ao enviar e-mail de boas-vindas.'
      )
    };
  }
}

module.exports = {
  isEmailConfigured,
  getEmailConfigStatus,
  buildActivationEmail,
  sendActivationEmail,
  buildManualWelcomeEmail,
  sendManualWelcomeEmail
};
