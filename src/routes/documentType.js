const express = require('express');
const router = express.Router();

const {
  getDocuments,
  createDocumentType
} = require('../controllers/controll-documentType');

router.post('/', createDocumentType);
router.get('/', getDocuments);


module.exports = router;
