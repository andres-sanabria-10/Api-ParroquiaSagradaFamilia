// models/payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true,
  },
  // 🎯 Tipo de servicio (misa o partida)
  serviceType: {
    type: String,
    required: true,
    enum: ['mass', 'certificate'], // misa o certificado/partida
  },
  // 🎯 Referencia dinámica al servicio
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'onModel', // Referencia dinámica según el modelo
  },
  // 🎯 Modelo al que pertenece el servicio
  onModel: {
    type: String,
    required: true,
    enum: ['RequestMass', 'RequestDeparture'],
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  // 🔑 ID único generado por nosotros
  referenceCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // 🔑 ID de transacción del gateway de pago
  transactionId: {
    type: String,
    sparse: true,
    index: true,
  },
  // Referencia genérica al gateway de pagos (ej: preference id de Mercado Pago)
  gatewayReference: {
    type: String,
    sparse: true,
    index: true,
  },
  // Datos crudos devueltos por el gateway (traza / debugging)
  gatewayData: {
    type: Object,
  },
  paymentMethod: {
    type: String,
    default: 'mercadopago',
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'failed', 'expired'], // ✅ Ya tienes 'expired'
    default: 'pending',
  },
  description: {
    type: String,
    required: true,
  },
  // 👤 Información del pagador
  payerInfo: {
    name: String,
    email: String,
    phone: String,
    documentType: String,
    documentNumber: String,
  },
  paymentDate: {
    type: Date,
    default: Date.now,
  },
  confirmedAt: {
    type: Date,
  },
  
  // ⏱️ ============= CAMPOS NUEVOS PARA EXPIRACIÓN =============
  
  // 📅 Fecha de expiración del pago pendiente
  expiresAt: {
    type: Date,
    index: true, // Para búsquedas rápidas de pagos expirados
  },
  
  // 📅 Fecha cuando el pago fue marcado como expirado
  expiredAt: {
    type: Date,
  },
  
  // ⏱️ ============= FIN CAMPOS NUEVOS =============
  
}, {
  timestamps: true, // Ya tienes createdAt y updatedAt
});

// Índices para búsquedas rápidas
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ serviceId: 1, serviceType: 1 });
paymentSchema.index({ expiresAt: 1, status: 1 }); // ⬅️ NUEVO: Para limpiezas eficientes

module.exports = mongoose.model('Payment', paymentSchema);