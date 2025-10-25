const mongoose = require('mongoose');

const tempVerificationSchema = new mongoose.Schema({
  mail: {
    type: String,
    required: true,
    unique: true
  },
  verificationCode: {
    type: String,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Índice para expiración automática
tempVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TempVerification = mongoose.model('TempVerification', tempVerificationSchema);

module.exports = TempVerification;