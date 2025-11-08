// routes/payment.js
const express = require('express');
const router = express.Router();
const { 
  createPayment, 
  confirmPayment,
  getPaymentHistory,
  getPaymentById,
  getPaymentStatus,
} = require('../controllers/controll-payment');

// Middleware de autenticación
const { checkAuth } = require('../middlewares/auth'); // Ajusta según tu middleware

// 🔐 Rutas protegidas (requieren JWT)
router.post('/create', checkAuth, createPayment);
router.get('/history', checkAuth, getPaymentHistory);
router.get('/status/:referenceCode', checkAuth, getPaymentStatus);
router.get('/:id', checkAuth, getPaymentById);

// 🌐 Ruta pública (webhook de ePayco - NO requiere autenticación)
router.post('/confirm', confirmPayment);

module.exports = router;