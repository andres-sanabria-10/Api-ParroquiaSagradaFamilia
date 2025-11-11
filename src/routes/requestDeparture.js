const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/auth'); // 👈 Importar middleware
const checkRoleAuth = require('../middleware/roleAuth');

const {
    createRequestDeparture,
    getAllRequestsSent,
    getAllRequestsEarring,
    sendDepartureDocument,
    deleteRequestById,
    checkExistingRequest
} = require('../controllers/controll-requestDeparture');

// ✅ Proteger la ruta con checkAuth
router.post('/', checkAuth, createRequestDeparture);

// ✅ Proteger rutas de administración
router.post('/send/:requestId', sendDepartureDocument);

router.get('/Sent', getAllRequestsSent);

router.get('/earring', getAllRequestsEarring);

router.delete('/:id', deleteRequestById);

// Nueva ruta para verificar si una solicitud existe para un usuario y tipo de partida
router.get('/check/:userId/:departureType', checkAuth, checkExistingRequest);

module.exports = router;