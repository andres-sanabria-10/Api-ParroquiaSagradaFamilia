// routes/payment.js
const express = require('express');
const router = express.Router();
const { 
  createPayment, 
  confirmPayment,
  getPaymentHistory,
  getPaymentById,
  getPaymentStatus,
  adminCreateCashPayment,
  generateReference,
  getAllPayments,
} = require('../controllers/controll-payment');

// Middleware de autenticación
const checkAuth = require('../middleware/auth');
const checkRoleAuth = require('../middleware/roleAuth');

// Utils
const { cleanExpiredNow } = require('../utils/paymentCleaner');

// 🔐 Rutas protegidas (requieren JWT)
router.post('/create', checkAuth, createPayment);
router.get('/history', checkAuth, getPaymentHistory);
router.get('/status/:referenceCode', checkAuth, getPaymentStatus);
router.get('/:id', checkAuth, getPaymentById);

// 🧹 Endpoint protegido para forzar limpieza manual de pagos expirados (admin)
router.post('/clean-expired', checkAuth, checkRoleAuth(['admin']), async (req, res) => {
  try {
    const cleaned = await cleanExpiredNow();
    return res.status(200).json({ success: true, cleaned });
  } catch (err) {
    console.error('Error en /payment/clean-expired:', err);
    return res.status(500).json({ success: false, error: 'Error al limpiar pagos expirados' });
  }
});

// 🌐 Ruta pública (webhook de Mercado Pago - NO requiere autenticación)
router.post('/confirm', confirmPayment);

router.post('/admin-cash-payment', adminCreateCashPayment);

router.get('/all/history', getAllPayments);

module.exports = router;