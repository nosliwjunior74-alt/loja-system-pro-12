'use strict';

const WHATSAPP_TOKEN =
  String(process.env.WHATSAPP_TOKEN || '').trim();

const WHATSAPP_PHONE_NUMBER_ID =
  String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

const ACTIVATION_TEMPLATE_NAME =
  String(
    process.env.PRO_WHATSAPP_ACTIVATION_TEMPLATE_NAME ||
    'ativacao_loja'
  ).trim();

const ACTIVATION_TEMPLATE_LANG =
  String(
    process.env.PRO_WHATSAPP_ACTIVATION_TEMPLATE_LANG ||
    'pt_BR'
  ).trim();

const GRAPH_API_VERSION =
  String(
    process.env.PRO_WHATSAPP_GRAPH_API_VERSION ||
    'v23.0'
  ).trim();

function isWhatsAppConfigured() {
  return Boolean(
    WHATSAPP_TOKEN &&
    WHATSAPP_PHONE_NUMBER_ID &&
    ACTIVATION_TEMPLATE_NAME
  );
}

function getWhatsAppConfigStatus() {
  return {
    configured: isWhatsAppConfigured(),
    tokenConfigured: Boolean(WHATSAPP_TOKEN),
    phoneNumberIdConfigured: Boolean(WHATSAPP_PHONE_NUMBER_ID),
    templateConfigured: Boolean(ACTIVATION_TEMPLATE_NAME),
    templateName: ACTIVATION_TEMPLATE_NAME,
    language: ACTIVATION_TEMPLATE_LANG,
    apiVersion: GRAPH_API_VERSION
  };
}

function normalizePhone(value) {
  let digits =
    String(value || '')
      .replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (
    (digits.length === 10 || digits.length === 11) &&
    !digits.startsWith('55')
  ) {
    digits = `55${digits}`;
  }

  if (digits.length < 12 || digits.length > 15) {
    return '';
  }

  return digits;
}

function buildActivationTemplatePayload(data = {}) {
  const to =
    normalizePhone(data.to);

  const recipientName =
    String(data.recipientName || 'Cliente').trim();

  const storeName =
    String(data.storeName || '').trim();

  const plan =
    String(data.plan || '').trim();

  const firstAccessUrl =
    String(data.firstAccessUrl || '').trim();

  if (!to) {
    throw new Error(
      'WhatsApp do cliente nao informado ou invalido.'
    );
  }

  if (!firstAccessUrl) {
    throw new Error(
      'Link de primeiro acesso nao informado.'
    );
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: ACTIVATION_TEMPLATE_NAME,
      language: {
        code: ACTIVATION_TEMPLATE_LANG
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: recipientName
            },
            {
              type: 'text',
              text: storeName
            },
            {
              type: 'text',
              text: plan
            },
            {
              type: 'text',
              text: firstAccessUrl
            }
          ]
        }
      ]
    }
  };
}

async function sendActivationWhatsApp(data = {}) {
  if (!isWhatsAppConfigured()) {
    return {
      ok: false,
      error:
        'WhatsApp de ativacao nao configurado no servidor.'
    };
  }

  let payload;

  try {
    payload =
      buildActivationTemplatePayload(data);
  } catch (err) {
    return {
      ok: false,
      error: String(
        err?.message ||
        'Dados invalidos para WhatsApp de ativacao.'
      )
    };
  }

  try {
    const response =
      await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization':
              `Bearer ${WHATSAPP_TOKEN}`
          },
          body: JSON.stringify(payload)
        }
      );

    const result =
      await response.json()
        .catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          result?.error?.message ||
          'Falha ao enviar WhatsApp de ativacao.'
      };
    }

    return {
      ok: true,
      messageId:
        String(
          result?.messages?.[0]?.id ||
          ''
        )
    };

  } catch (err) {
    return {
      ok: false,
      error: String(
        err?.message ||
        'Falha de comunicacao com WhatsApp.'
      )
    };
  }
}

module.exports = {
  isWhatsAppConfigured,
  getWhatsAppConfigStatus,
  normalizePhone,
  buildActivationTemplatePayload,
  sendActivationWhatsApp
};
