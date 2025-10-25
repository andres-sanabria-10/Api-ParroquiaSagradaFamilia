const DocumentType = require('../models/DocumentType');

module.exports = {
  getDocuments: async (req, res) => {
    try {
      const result = await DocumentType.find();
      return res.status(200).json({ data: result });
    } catch (err) {
      console.error('Error getting document types:', err);
      return res.status(500).json({ err: err.message });
    }
  },

  createDocumentType: async (req, res) => {
    try {
      const { document_type_name } = req.body;
      if (!document_type_name) {
        return res.status(400).json({ err: 'document_type_name is required' });
      }
      const documentType = new DocumentType({ document_type_name });
      const result = await documentType.save();
      return res.status(201).json({ data: result });
    } catch (err) {
      console.error('Error creating document type:', err);
      return res.status(500).json({ err: err.message });
    }
  }
};