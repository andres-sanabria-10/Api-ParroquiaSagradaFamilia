const Confirmation = require('../models/confirmation');
const User = require('../models/user');

// --- ✨ NUEVAS DEPENDENCIAS ---
// Asumo que tienes estos servicios de tu proyecto anterior
const path = require('path');
const fs = require('fs');
const pdfGenerator = require('../services/pdfGenerator'); // Asumo que existe
const emailService = require('../services/emailService');   // Asumo que existe

module.exports = {
  // Obtener todas las confirmaciones
  getAllConfirmations: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const confirmations = await Confirmation.find().populate({
        path: 'confirmed',
        select: 'name lastName documentNumber mail role'
      });

      res.json(confirmations);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // Crear una nueva confirmación
  createConfirmation: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const confirmationDate = new Date(req.body.confirmationDate);
      const currentDate = new Date();
      if (confirmationDate > currentDate) {
        return res.status(400).json({ message: "La fecha de confirmación no puede ser futura" });
      }

      const user = await User.findOne({ documentNumber: req.body.documentNumber });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const confirmationData = {
        ...req.body,
        confirmed: user._id 
      };
      delete confirmationData.documentNumber; 

      const newConfirmation = new Confirmation(confirmationData);
      const savedConfirmation = await newConfirmation.save();
      res.status(201).json(savedConfirmation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para obtener una confirmación por número de documento del usuario
  getConfirmationByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const confirmation = await Confirmation.findOne({ confirmed: user._id }).populate({
        path: 'confirmed',
        select: 'name lastName documentNumber mail role'
      });
      
      if (!confirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para este usuario' });
      }
      
      res.json(confirmation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para actualizar una confirmación por número de documento del usuario
  updateConfirmationByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const updatedConfirmation = await Confirmation.findOneAndUpdate(
        { confirmed: user._id },
        req.body,
        { new: true }
      ).populate('confirmed');
      
      if (!updatedConfirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para actualizar' });
      }
      
      res.json(updatedConfirmation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para eliminar una confirmación por número de documento del usuario
  deleteConfirmationByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const deletedConfirmation = await Confirmation.findOneAndDelete({ confirmed: user._id });
      
      if (!deletedConfirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para eliminar' });
      }
      
      res.json({ message: 'Confirmación eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // --- ✨ NUEVO ENDPOINT PARA ENVIAR POR CORREO ---
  sendConfirmationByEmail: async (req, res) => {
    // 1. Obtenemos el DNI y el correo del cuerpo de la solicitud
    const { documentNumber, sendToEmail } = req.body;

    // 2. Validamos que tengamos los datos necesarios
    if (!documentNumber || !sendToEmail) {
      return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
    }

    try {
      // 3. Buscamos la confirmación (usando la misma lógica que ya tenías)
      const user = await User.findOne({ documentNumber: documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Usamos el campo 'confirmed' que es específico de este modelo
      const confirmation = await Confirmation.findOne({ confirmed: user._id }).populate('confirmed');
      if (!confirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para este usuario' });
      }

      // 4. Generar el PDF
      const pdfPath = path.join(__dirname, '..', 'temp', `confirmacion_${documentNumber}.pdf`);
      
      // Asumo que tu generador de PDF maneja el tipo 'confirmation'
      await pdfGenerator.generatePDF('confirmation', confirmation, pdfPath);

      // 5. Enviar el correo
      await emailService.sendCertificate({
        to: sendToEmail,
        subject: `Partida de Confirmación - ${confirmation.confirmed.name} ${confirmation.confirmed.lastName}`,
        userName: confirmation.confirmed.name,
        documentType: 'Confirmación',
        pdfPath: pdfPath
      });

      // 6. Limpiar el archivo PDF temporal
      fs.unlinkSync(pdfPath);

      // 7. Enviar respuesta de éxito
      res.status(200).json({ message: `Partida de confirmación enviada exitosamente a ${sendToEmail}` });

    } catch (error) {
      console.error('Error al enviar la partida de confirmación:', error);
      res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }
};