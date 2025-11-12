const Payment = require('../models/payment');
const MassSchedule = require('../models/massSchedule');
const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');

const PAYMENT_CLEAN_LOG_PREFIX = 'paymentCleaner';

/**
 * Limpia pagos pendientes expirados en toda la colección.
 * - Marca payments con status 'pending' y expiresAt < now como 'expired'
 * - Libera reservas en MassSchedule relacionadas
 * - Marca RequestMass / RequestDeparture como 'Expirada'
 */
const cleanExpiredNow = async () => {
  try {
    const now = new Date();
    const expiredPayments = await Payment.find({ status: 'pending', expiresAt: { $lt: now } });

    if (!expiredPayments || expiredPayments.length === 0) {
      // nothing to do
      return 0;
    }

    console.log(`${PAYMENT_CLEAN_LOG_PREFIX} 🧹 Encontrados ${expiredPayments.length} pagos pendientes expirados`);

    // Marcar como expired en bloque
    const ids = expiredPayments.map(p => p._id);
    await Payment.updateMany({ _id: { $in: ids } }, { $set: { status: 'expired', expiredAt: now } });

    // Liberar reservas y actualizar requests por cada pago
    for (const p of expiredPayments) {
      try {
        if (p.serviceType === 'mass' && p.serviceId) {
          const reqId = p.serviceId;
          await MassSchedule.updateMany(
            { 'timeSlots.reservedBy': reqId },
            {
              $set: {
                'timeSlots.$.status': 'Libre',
                'timeSlots.$.available': true,
                'timeSlots.$.reservedBy': null,
                'timeSlots.$.reservedUntil': null
              }
            }
          );
          await RequestMass.findByIdAndUpdate(reqId, { status: 'Expirada' }).catch(() => {});
        }

        if (p.serviceType === 'certificate' && p.serviceId) {
          const reqIdCert = p.serviceId;
          await RequestDeparture.findByIdAndUpdate(reqIdCert, { status: 'Expirada' }).catch(() => {});
        }
      } catch (errInner) {
        console.error(`${PAYMENT_CLEAN_LOG_PREFIX} ❌ Error procesando pago ${p._id}:`, errInner);
      }
    }

    console.log(`${PAYMENT_CLEAN_LOG_PREFIX} ✅ Limpieza completada`);
    return expiredPayments.length;
  } catch (error) {
    console.error(`${PAYMENT_CLEAN_LOG_PREFIX} 💥 Error limpiando pagos expirados:`, error);
    return 0;
  }
};

/**
 * Inicia un job periódico en memoria que llama a cleanExpiredNow cada intervalMinutes.
 * Nota: en producción es preferible usar un job externo (cron, worker) en lugar de setInterval en el proceso web.
 */
const startPaymentCleaner = ({ intervalMinutes = 3 } = {}) => {
  try {
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    console.log(`${PAYMENT_CLEAN_LOG_PREFIX} ⏱️ Iniciando job para limpiar pagos expirados cada ${intervalMinutes} minuto(s)`);

    // Ejecutar inmediatamente una vez y luego en interval
    cleanExpiredNow().catch(err => console.error(`${PAYMENT_CLEAN_LOG_PREFIX} ❌ Error inicial al limpiar:`, err));

    const timer = setInterval(() => {
      cleanExpiredNow().catch(err => console.error(`${PAYMENT_CLEAN_LOG_PREFIX} ❌ Error en job periódico:`, err));
    }, intervalMs);

    // Retornar el timer por si el caller quiere detenerlo
    return timer;
  } catch (err) {
    console.error(`${PAYMENT_CLEAN_LOG_PREFIX} 💥 Error iniciando payment cleaner:`, err);
    return null;
  }
};

module.exports = {
  startPaymentCleaner,
  cleanExpiredNow,
};
