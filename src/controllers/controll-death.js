const Death = require('../models/death'); 
const User = require('../models/user');

// --- ✨ NUEVA DEPENDENCIA ---
const emailService = require('../services/emailService'); // Asumo que existe


module.exports = {
  // Obtener todas las defunciones
  getAllDeaths: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const deaths = await Death.find().populate({
        path: 'dead',
        select: 'name lastName documentNumber mail role'
      });

      res.json(deaths);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  },

  // Crear una nueva defunción
  createDeath: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const deathDate = new Date(req.body.deathDate);
      const currentDate = new Date();
      if (deathDate > currentDate) {
        return res.status(400).json({ message: "La fecha de defunción no puede ser futura" });
      }

      const existingDeath = await Death.findOne({ "dead.documentNumber": req.body.documentNumber });
      if (existingDeath) {
        return res.status(400).json({ message: "Ya existe un registro de defunción para este número de documento" });
      }

      const user = await User.findOne({ documentNumber: req.body.documentNumber });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      const defaultFuneralDate = new Date(deathDate);
      defaultFuneralDate.setDate(defaultFuneralDate.getDate() + 2);

      const deathData = {
        ...req.body,
        dead: user._id, 
        funeralDate: req.body.funeralDate || defaultFuneralDate
      };
      delete deathData.documentNumber;

      const newDeath = new Death(deathData);
      const saveDeath = await newDeath.save();
      res.status(201).json(saveDeath);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para obtener una defunción por número de documento del usuario
  getDeathByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const death = await Death.findOne({ dead: user._id }).populate({
        path: 'dead',
        select: 'name lastName documentNumber mail role'
      });
      
      if (!death) {
        return res.status(404).json({ message: 'Defunción no encontrada para este usuario' });
      }
      
      res.json(death);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para actualizar una defunción por número de documento del usuario
  updateDeathByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const updatedDeath = await Death.findOneAndUpdate(
        { dead: user._id },
        req.body,
        { new: true }
      ).populate('dead');
      
      if (!updatedDeath) {
        return res.status(404).json({ message: 'Defunción no encontrada para actualizar' });
      }
      
      res.json(updatedDeath);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para eliminar una defunción por número de documento del usuario
  deleteDeathByDocumentNumber: async (req, res) => {
    // (Tu código existente... se mantiene igual)
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const deletedDeath = await Death.findOneAndDelete({ dead: user._id });
      
      if (!deletedDeath) {
        return res.status(404).json({ message: 'Defunción no encontrada para eliminar' });
      }
      
      res.json({ message: 'Defunción eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // --- ✨ NUEVO ENDPOINT PARA ENVIAR POR CORREO ---
  sendDeathByEmail: async (req, res) => {
    // 1. Obtenemos el DNI y el correo del cuerpo
    const { documentNumber, sendToEmail } = req.body;

    if (!documentNumber || !sendToEmail) {
      return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
    }

    try {
      // 2. Buscamos la defunción
      const user = await User.findOne({ documentNumber: documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const death = await Death.findOne({ dead: user._id }).populate('dead');
      if (!death) {
        return res.status(404).json({ message: 'Defunción no encontrada para este usuario' });
      }

      // 3. Creamos el objeto 'requestData' que tu servicio de email espera
      const requestData = {
        departureType: 'Death', // Con 'D' mayúscula para tu pdfGenerator
        applicant: {
          name: death.dead.name,
          mail: sendToEmail // ✨ El email que la secretaria ingresó
        }
      };
      
      // 4. Llamamos a la función correcta de tu servicio
      await emailService.sendDepartureDocument(requestData, death);

      // 5. Enviar respuesta de éxito
      res.status(200).json({ message: `Partida de defunción enviada exitosamente a ${sendToEmail}` });

    } catch (error) {
      console.error('Error al enviar la partida de defunción:', error);
      res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }
};