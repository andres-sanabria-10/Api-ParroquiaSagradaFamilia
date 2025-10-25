const express = require('express');
const router = express.Router();
const {
  createConfirmation,
  getAllConfirmations,
  getConfirmationByDocumentNumber,
  updateConfirmationByDocumentNumber,
  deleteConfirmationByDocumentNumber
} = require('../controllers/controll-confirmation');

// Ruta para crear un nueva confirmación
router.post('/', createConfirmation);

// Ruta para obtener todas las confirmaciones
router.get('/', getAllConfirmations);

// Ruta para obtener una confirmación por número de documento
router.get('/:documentNumber', getConfirmationByDocumentNumber);

// Ruta para actualizar una confirmación por número de documento
router.put('/:documentNumber', updateConfirmationByDocumentNumber);

// Ruta para eliminar una confirmación por número de documento
router.delete('/:documentNumber', deleteConfirmationByDocumentNumber);

module.exports = router;