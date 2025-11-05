const Baptism = require('../models/baptism');
const User = require('../models/user');

// --- ✨ NUEVAS DEPENDENCIAS ---
// Asumo que tienes estos servicios de tu proyecto anterior
const path = require('path');
const fs = require('fs');
const pdfGenerator = require('../services/pdfGenerator'); // Asumo que existe
const emailService = require('../services/emailService');   // Asumo que existe


module.exports = {

  // Controlador para crear un nuevo bautismo
  createBaptism: async (req, res) => {
    try {
      // (Tu código existente... se mantiene igual)
      const baptismDate = new Date(req.body.baptismDate);
      const currentDate = new Date();
      if (baptismDate > currentDate) {
        return res.status(400).json({ message: "La fecha de bautismo no puede ser futura" });
      }
      const user = await User.findOne({ documentNumber: req.body.documentNumber });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }
      const baptismData = {
        ...req.body,
        baptized: user._id
      };
      delete baptismData.documentNumber;
      const newBaptism = new Baptism(baptismData);
      const saveBaptism = await newBaptism.save();
      res.status(201).json(saveBaptism);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para obtener todos los bautismos
  getAllBaptisms: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const baptisms = await Baptism.find().populate({
        path: 'baptized',
        select: 'name lastName documentNumber mail role' 
      });
      res.json(baptisms);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para obtener un bautismo por número de documento del usuario
  getBaptismByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      const baptism = await Baptism.findOne({ baptized: user._id }).populate({
        path: 'baptized',
        select: 'name lastName documentNumber mail role'
      });
      if (!baptism) {
        return res.status(404).json({ message: 'Bautismo no encontrado para este usuario' });
      }
      res.json(baptism);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para actualizar un bautismo por número de documento del usuario
  updateBaptismByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      const updateBaptism = await Baptism.findOneAndUpdate(
        { baptized: user._id },
        req.body,
        { new: true }
      ).populate('baptized');
      if (!updateBaptism) {
        return res.status(404).json({ message: 'Bautismo no encontrado para actualizar' });
      }
      res.json(updateBaptism);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para eliminar un bautismo por número de documento del usuario
  deleteBaptismByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      const deleteBaptism = await Baptism.findOneAndDelete({ baptized: user._id });
      if (!deleteBaptism) {
        return res.status(404).json({ message: 'Bautismo no encontrado para eliminar' });
      }
      res.json({ message: 'Bautismo eliminado correctamente' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // --- ✨ NUEVO ENDPOINT PARA ENVIAR POR CORREO ---
  sendBaptismByEmail: async (req, res) => {
    // 1. Obtenemos el DNI y el correo del cuerpo de la solicitud
    const { documentNumber, sendToEmail } = req.body;

    // 2. Validamos que tengamos los datos necesarios
    if (!documentNumber || !sendToEmail) {
      return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
    }

    try {
      // 3. Buscamos el bautismo (usando la misma lógica que ya tenías)
      const user = await User.findOne({ documentNumber: documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const baptism = await Baptism.findOne({ baptized: user._id }).populate('baptized');
      if (!baptism) {
        return res.status(404).json({ message: 'Bautismo no encontrado para este usuario' });
      }

      // 4. Generar el PDF (Asumiendo que tu servicio existe)
      // Asegúrate de que la carpeta 'temp' exista en la raíz de tu backend
      const pdfPath = path.join(__dirname, '..', 'temp', `bautismo_${documentNumber}.pdf`);
      
      // Asumo que tu generador de PDF tiene una función 'generatePDF'
      // y que puede manejar un tipo 'baptism'
      await pdfGenerator.generatePDF('Baptism', baptism, pdfPath);

      // 5. Enviar el correo (Asumiendo que tu servicio existe)
      // Asumo que tu servicio de email tiene una función 'sendCertificate'
      await emailService.sendCertificate({
        to: sendToEmail,
        subject: `Partida de Bautismo - ${baptism.baptized.name} ${baptism.baptized.lastName}`,
        userName: baptism.baptized.name,
        documentType: 'Bautismo',
        pdfPath: pdfPath
      });

      // 6. Limpiar el archivo PDF temporal
      fs.unlinkSync(pdfPath);

      // 7. Enviar respuesta de éxito
      res.status(200).json({ message: `Partida de bautismo enviada exitosamente a ${sendToEmail}` });

    } catch (error) {
      console.error('Error al enviar la partida de bautismo:', error);
      res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }
};