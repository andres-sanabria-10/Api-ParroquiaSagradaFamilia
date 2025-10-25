const express = require('express');
const router = express.Router();

const {
    createMass,
    removeTimeSlots,
    getTimeSlots
} = require('../controllers/controll-massSchedule');

router.post('/', createMass);

// Ruta para eliminar un horario disponible
router.post('/remove-time-slots', removeTimeSlots);

// Ruta para obtener los horarios
router.get('/time-slots', getTimeSlots);  
module.exports = router;