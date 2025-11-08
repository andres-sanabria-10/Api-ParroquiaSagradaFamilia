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
  // 🔑 Referencia de ePayco (x_ref_payco)
  epaycoReference: {
    type: String,
    sparse: true,
    index: true,
  },
  // 🔑 ID de transacción de ePayco
  transactionId: {
    type: String,
    sparse: true,
    index: true,
  },
  paymentMethod: {
    type: String,
    default: 'epayco',
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'approved', 'rejected', 'failed'],
    default: 'pending',
  },
  // 📋 Información detallada de ePayco
  epaycoData: {
    franchise: String,       // Visa, Mastercard, etc.
    bank: String,           // Banco emisor
    receipt: String,        // Recibo
    authorization: String,  // Código de autorización
    responseCode: String,   // Código de respuesta (1=aprobado, 2=rechazado, etc.)
    responseMessage: String, // Mensaje de respuesta
    transactionDate: Date,  // Fecha de la transacción
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
}, {
  timestamps: true,
});

// Índices para búsquedas rápidas
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ serviceId: 1, serviceType: 1 });

module.exports = mongoose.model('Payment', paymentSchema);