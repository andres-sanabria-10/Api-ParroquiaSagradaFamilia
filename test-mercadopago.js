/**
 * Script simple para verificar configuración de Mercado Pago
 * Uso: node test-mercadopago.js
 */
const log = console;
const servicio = require('./src/services/mercadoPagoService');

async function run() {
  log.log('🔎 Verificando variables de entorno...');
  const token = process.env.mercado_pago_token || process.env.MERCADO_PAGO_TOKEN;
  const pub = process.env.mercado_pago_public_key || process.env.MERCADO_PAGO_PUBLIC_KEY;

  log.log('mercado_pago_token:', token ? (token.substring(0, 8) + '...') : 'NO CONFIGURADO');
  log.log('mercado_pago_public_key:', pub ? (pub.substring(0, 8) + '...') : 'NO CONFIGURADO');

  if (!token) {
    log.error('❌ MERCADO PAGO token no configurado. Añade mercado_pago_token en .env');
    process.exit(1);
  }

  try {
    log.log('📡 Creando preference de prueba (sandbox)...');
    const pref = await servicio.createPreference({
      items: [{ id: 'test-1', title: 'Prueba', quantity: 1, unit_price: 1, currency_id: 'COP' }],
      payer: { email: 'test@example.com', name: 'Prueba' },
      back_urls: { success: 'https://example.com', failure: 'https://example.com', pending: 'https://example.com' },
      external_reference: 'TEST-REF-1'
    });

    log.log('✅ Preference creada:', { id: pref.id, init_point: pref.init_point });
    process.exit(0);
  } catch (err) {
    log.error('❌ Error creando preference de prueba:', err.message || err);
    process.exit(1);
  }
}

run();
