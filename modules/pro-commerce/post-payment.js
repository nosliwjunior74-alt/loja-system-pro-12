'use strict';

const {
  sendActivationEmail
} = require('./notifications/email');

const {
  sendActivationWhatsApp
} = require('./notifications/whatsapp');

async function sendChannelOnce({
  channel,
  claimNotification,
  completeNotification,
  failNotification,
  sender,
  payload
}) {
  let claim = null;

  try {
    claim = await claimNotification(channel);

    if (!claim?.claimed) {
      return {
        ok: true,
        skipped: true,
        channel,
        reason: claim?.reason || 'already_processed'
      };
    }

    const result = await sender(payload);

    if (!result?.ok) {
      await failNotification(channel, result || {});

      return {
        ok: false,
        skipped: false,
        channel,
        error:
          result?.error ||
          'Falha no envio da notificacao.'
      };
    }

    await completeNotification(channel, result);

    return {
      ok: true,
      skipped: false,
      channel,
      messageId:
        String(result.messageId || '')
    };

  } catch (err) {
    try {
      if (claim?.claimed) {
        await failNotification(channel, {
          error: String(
            err?.message ||
            'Falha inesperada na notificacao.'
          )
        });
      }
    } catch (_) {}

    return {
      ok: false,
      skipped: false,
      channel,
      error: String(
        err?.message ||
        'Falha inesperada na notificacao.'
      )
    };
  }
}

async function runPostPaymentFlow(options = {}) {
  const {
    order,
    baseUrl = '',
    brandName = 'Provador Pro System',

    activateStore,
    buildFirstAccessUrl,

    claimNotification,
    completeNotification,
    failNotification
  } = options;

  if (!order?.id) {
    return {
      ok: false,
      code: 'order_required'
    };
  }

  if (typeof activateStore !== 'function') {
    return {
      ok: false,
      code: 'activate_store_required'
    };
  }

  if (typeof buildFirstAccessUrl !== 'function') {
    return {
      ok: false,
      code: 'first_access_url_builder_required'
    };
  }

  if (
    typeof claimNotification !== 'function' ||
    typeof completeNotification !== 'function' ||
    typeof failNotification !== 'function'
  ) {
    return {
      ok: false,
      code: 'notification_control_required'
    };
  }

  let activation;

  try {
    activation =
      await activateStore(
        order.id,
        baseUrl
      );
  } catch (err) {
    return {
      ok: false,
      code: 'activation_exception',
      error: String(
        err?.message ||
        'Falha ao ativar o produto.'
      )
    };
  }

  if (!activation?.ok) {
    return {
      ok: false,
      code:
        activation?.code ||
        'activation_failed',
      activation
    };
  }

  const activatedOrder =
    activation.order || order;

  const store =
    activation.store || null;

  let firstAccessUrl = '';

  try {
    firstAccessUrl =
      String(
        await buildFirstAccessUrl({
          order: activatedOrder,
          store,
          baseUrl
        }) || ''
      ).trim();
  } catch (err) {
    return {
      ok: false,
      code: 'first_access_url_failed',
      activation,
      error: String(
        err?.message ||
        'Falha ao gerar link de primeiro acesso.'
      )
    };
  }

  if (!firstAccessUrl) {
    return {
      ok: false,
      code: 'first_access_url_empty',
      activation
    };
  }

  const commonPayload = {
    recipientName:
      activatedOrder.buyerName || '',
    storeName:
      activatedOrder.storeName ||
      store?.name ||
      '',
    plan:
      activatedOrder.plan || '',
    billingCycle:
      activatedOrder.billingCycle || 'monthly',
    amountCents:
      Number(activatedOrder.amountCents || 0),
    firstAccessUrl,
    brandName
  };

  const email =
    activatedOrder.buyerEmail
      ? await sendChannelOnce({
          channel: 'email',
          claimNotification,
          completeNotification,
          failNotification,
          sender: sendActivationEmail,
          payload: {
            ...commonPayload,
            to: activatedOrder.buyerEmail
          }
        })
      : {
          ok: true,
          skipped: true,
          channel: 'email',
          reason: 'no_email'
        };

  const whatsapp =
    activatedOrder.buyerPhone
      ? await sendChannelOnce({
          channel: 'whatsapp',
          claimNotification,
          completeNotification,
          failNotification,
          sender: sendActivationWhatsApp,
          payload: {
            ...commonPayload,
            to: activatedOrder.buyerPhone
          }
        })
      : {
          ok: true,
          skipped: true,
          channel: 'whatsapp',
          reason: 'no_phone'
        };

  return {
    ok: true,
    activation,
    firstAccessUrl,
    notifications: {
      email,
      whatsapp
    }
  };
}

module.exports = {
  runPostPaymentFlow
};
