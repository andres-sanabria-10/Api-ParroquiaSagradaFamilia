const axios = require('axios');

const ACCESS_TOKEN = process.env.mercado_pago_token || process.env.MERCADO_PAGO_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.mercado_pago_public_key || process.env.MERCADO_PAGO_PUBLIC_KEY || process.env.MERCADOPAGO_PUBLIC_KEY;

// ⭐ NUEVO: Log de configuración al iniciar
console.log('🔧 Mercado Pago Service inicializado:');
console.log('🔑 ACCESS_TOKEN:', ACCESS_TOKEN ? `${ACCESS_TOKEN.substring(0, 20)}... (${ACCESS_TOKEN.length} caracteres)` : '❌ AUSENTE');
console.log('🔑 PUBLIC_KEY:', PUBLIC_KEY ? `${PUBLIC_KEY.substring(0, 20)}...` : '❌ AUSENTE');

if (!ACCESS_TOKEN) {
  console.warn('⚠️  MERCADO PAGO: access token no configurado (env: mercado_pago_token)');
}

const MP_API_BASE = 'https://api.mercadopago.com';

const createPreference = async ({ items, payer, back_urls, auto_return = 'approved', external_reference, notification_url }) => {
  try {
    const body = {
      items,
      payer,
      back_urls,
      auto_return,
      external_reference,
      notification_url // ⭐ Agregar notification_url
    };

    // ⭐ NUEVO: Logs detallados ANTES de enviar
    console.log('\n📤 ========== MERCADO PAGO API REQUEST ==========');
    console.log('🌐 URL:', `${MP_API_BASE}/checkout/preferences`);
    console.log('🔑 Authorization:', `Bearer ${ACCESS_TOKEN?.substring(0, 20)}...`);
    console.log('📦 Body enviado a Mercado Pago:');
    console.log(JSON.stringify(body, null, 2));
    console.log('================================================\n');

    const resp = await axios.post(`${MP_API_BASE}/checkout/preferences`, body, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    // ⭐ NUEVO: Logs detallados de RESPUESTA exitosa
    console.log('\n✅ ========== MERCADO PAGO API RESPONSE (SUCCESS) ==========');
    console.log('📊 Status:', resp.status);
    console.log('📦 Data recibida:');
    console.log(JSON.stringify(resp.data, null, 2));
    console.log('🔗 Init Point:', resp.data.init_point);
    console.log('🆔 Preference ID:', resp.data.id);
    console.log('===========================================================\n');

    return resp.data;
  } catch (err) {
    // ⭐ NUEVO: Logs detallados de ERROR
    console.error('\n❌ ========== MERCADO PAGO API ERROR ==========');
    console.error('📊 HTTP Status:', err.response?.status);
    console.error('📋 Error Data:', JSON.stringify(err.response?.data, null, 2));
    console.error('💬 Error Message:', err.message);
    
    if (err.response?.data) {
      console.error('🔍 Detalles del error de MP:');
      console.error('   - message:', err.response.data.message);
      console.error('   - error:', err.response.data.error);
      console.error('   - status:', err.response.data.status);
      console.error('   - cause:', JSON.stringify(err.response.data.cause, null, 2));
    }
    
    console.error('===============================================\n');
    
    // envolver para debugging
    const e = new Error('MercadoPago createPreference error: ' + (err.response?.data?.message || err.message));
    e.raw = err;
    e.mpError = err.response?.data; // ⭐ NUEVO: Agregar error completo de MP
    e.mpStatus = err.response?.status; // ⭐ NUEVO: Agregar status HTTP
    throw e;
  }
};

const getPaymentById = async (paymentId) => {
  try {
    console.log(`🔍 Consultando pago en Mercado Pago API: ${paymentId}`);
    
    const resp = await axios.get(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    
    console.log(`✅ Pago encontrado en MP: ${paymentId} - Status: ${resp.data.status}`);
    return resp.data;
  } catch (err) {
    console.error(`❌ Error al obtener pago ${paymentId} de MP:`, err.response?.data || err.message);
    
    const e = new Error('MercadoPago getPaymentById error: ' + (err.response?.data?.message || err.message));
    e.raw = err;
    e.mpError = err.response?.data;
    throw e;
  }
};

module.exports = {
  createPreference,
  getPaymentById,
  PUBLIC_KEY,
};