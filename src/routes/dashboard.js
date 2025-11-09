const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getRecentActivity
} = require('../controllers/controll-dashboradControl');


// Ruta para las tarjetas de estadísticas
router.get('/stats', getDashboardStats);

// Ruta para el feed de actividad reciente
router.get('/recent-activity', getRecentActivity);

module.exports = router;