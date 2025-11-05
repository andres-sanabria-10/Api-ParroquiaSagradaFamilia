const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/auth')
const checkRoleAuth = require('../middleware/roleAuth')

const {
  createBaptism,
  getAllBaptisms,
  getBaptismByDocumentNumber,
  updateBaptismByDocumentNumber,
  deleteBaptismByDocumentNumber,
  sendBaptismByEmail
} = require('../controllers/controll-baptism');

// Ruta para crear un nuevo bautismo
router.post('/', createBaptism);

// Ruta para obtener todos los bautismos
router.get('/', getAllBaptisms);

// Ruta para obtener un bautismo por número de documento
router.get('/:documentNumber', getBaptismByDocumentNumber);

// Ruta para actualizar un bautismo por número de documento
router.put('/:documentNumber', updateBaptismByDocumentNumber);

// Ruta para eliminar un bautismo por número de documento
router.delete('/:documentNumber', deleteBaptismByDocumentNumber);

// Ruta para enviar un bautismo por correo
router.post('/send-email', sendBaptismByEmail);

module.exports = router;