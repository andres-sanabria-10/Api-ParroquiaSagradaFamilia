const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/auth'); // 👈 Importar middleware
const checkRoleAuth = require('../middleware/roleAuth');

const {
    createRequestDeparture,
    getAllRequestsSent,
    getAllRequestsEarring,
    sendDepartureDocument,
    deleteRequestById
} = require('../controllers/controll-requestDeparture');

// ✅ Proteger la ruta con checkAuth
router.post('/', checkAuth, createRequestDeparture);

// ✅ Proteger rutas de administración
router.post('/send/:requestId', checkAuth, sendDepartureDocument);

router.get('/Sent', checkAuth, getAllRequestsSent);

router.get('/earring', getAllRequestsEarring);

router.delete('/:id', checkAuth, deleteRequestById);

module.exports = router;