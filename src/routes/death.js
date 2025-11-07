const express = require('express');
const router = express.Router();
const {
  getAllDeaths,
  createDeath,
  getDeathByDocumentNumber,
  updateDeathByDocumentNumber,
  deleteDeathByDocumentNumber,
  sendDeathByEmail
} = require('../controllers/controll-death'); // Ajusta la ruta según tu estructura de proyecto

// Ruta para obtener todas las defunciones
router.get('/', getAllDeaths);

// Ruta para crear una nueva defunción
router.post('/', createDeath);

// Ruta para obtener una defunción por número de documento
router.get('/:documentNumber', getDeathByDocumentNumber);

// Ruta para actualizar una defunción por número de documento
router.put('/:documentNumber', updateDeathByDocumentNumber);

// Ruta para eliminar una defunción por número de documento
router.delete('/:documentNumber', deleteDeathByDocumentNumber);

// Ruta para enviar una defunción por correo
router.post('/send', sendDeathByEmail);

module.exports = router;
