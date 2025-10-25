const express = require('express');
const router = express.Router();


const {
  createRequestMass,
  getPendingRequestMasses,
  getConfirmedRequestMasses,
  confirmRequest,
  deleteRequest
  } = require('../controllers/controll-requestMass');

// Crear una nueva solicitud de misa
router.post('/', createRequestMass);


router.post('/confirm/:id', confirmRequest);

router.get('/earring', getPendingRequestMasses);

router.get('/confirmed', getConfirmedRequestMasses);

router.delete('/:id', deleteRequest);

module.exports = router;