const express = require('express');
const router = express.Router();
const {
  getAllMarriages,
  createMarriage,
  getMarriageByDocumentNumber,
  updateMarriageByDocumentNumber,
  deleteMarriageByDocumentNumber,
  sendMarriageByEmail
} = require('../controllers/controll-marriage');

// Ruta para obtener todos los registros de matrimonio
router.get('/', getAllMarriages);

// Ruta para crear un nuevo registro de matrimonio
router.post('/', createMarriage);

// Ruta para obtener un registro de matrimonio por número de documento
router.get('/:documentNumber', getMarriageByDocumentNumber);

// Ruta para actualizar un registro de matrimonio por número de documento
router.put('/:documentNumber', updateMarriageByDocumentNumber);

// Ruta para eliminar un registro de matrimonio por número de documento
router.delete('/:documentNumber', deleteMarriageByDocumentNumber);

// Ruta para enviar un registro de matrimonio por correo
router.post('/send', sendMarriageByEmail);

module.exports = router;
