const axios = require('axios');

const ACCESS_TOKEN = process.env.mercado_pago_token || process.env.MERCADO_PAGO_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.mercado_pago_public_key || process.env.MERCADO_PAGO_PUBLIC_KEY || process.env.MERCADOPAGO_PUBLIC_KEY;

if (!ACCESS_TOKEN) {
  console.warn('⚠️  MERCADO PAGO: access token no configurado (env: mercado_pago_token)');
}

const MP_API_BASE = 'https://api.mercadopago.com';

const createPreference = async ({ items, payer, back_urls, auto_return = 'approved', external_reference }) => {
  try {
    const body = {
      items,
      payer,
      back_urls,
      auto_return,
      external_reference,
    };

    const resp = await axios.post(`${MP_API_BASE}/checkout/preferences`, body, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return resp.data;
  } catch (err) {
    // envolver para debugging
    const e = new Error('MercadoPago createPreference error: ' + (err.response?.data?.message || err.message));
    e.raw = err;
    throw e;
  }
};

const getPaymentById = async (paymentId) => {
  try {
    const resp = await axios.get(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    return resp.data;
  } catch (err) {
    const e = new Error('MercadoPago getPaymentById error: ' + (err.response?.data?.message || err.message));
    e.raw = err;
    throw e;
  }
};

module.exports = {
  createPreference,
  getPaymentById,
  PUBLIC_KEY,
};
