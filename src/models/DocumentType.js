const mongoose = require('mongoose');

const documentTypeSchema = new mongoose.Schema({
  document_type_name: {
    type: String,
    required: true,
  }
});

const DocumentType = mongoose.model('DocumentType', documentTypeSchema);

module.exports = DocumentType;