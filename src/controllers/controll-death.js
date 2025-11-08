const Death = require('../models/death'); 
const User = require('../models/user');
const { encrypt } = require('../helpers/handleBcrypt');
const emailService = require('../services/emailService');

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
      try {
        // 1. Validación de Fecha
        const deathDate = new Date(req.body.deathDate);
        const currentDate = new Date();
        if (deathDate > currentDate) {
          return res.status(400).json({ message: "La fecha de defunción no puede ser futura" });
        }
  
        // 2. Buscar al usuario por DNI
        let user = await User.findOne({ documentNumber: req.body.documentNumber });
  
        // 3. Si el usuario NO existe, lo creamos
        if (!user) {
          const { name, lastName, mail, birthdate, documentNumber } = req.body;
          if (!name || !lastName || !mail || !birthdate || !documentNumber) {
            return res.status(400).json({ message: "Faltan datos del fallecido (nombre, apellido, email, fecha de nac.) para crear el nuevo usuario." });
          }
          const tempPassword = await encrypt(documentNumber);
          const newUser = new User({
            name,
            lastName,
            mail,
            birthdate,
            documentNumber,
            password: tempPassword,
            role: 'feligres'
          });
          user = await newUser.save();
        }
  
        // 4. Preparar y guardar la partida de defunción
        const defaultFuneralDate = new Date(deathDate);
        defaultFuneralDate.setDate(defaultFuneralDate.getDate() + 2);
  
        const finalDeathData = {
          dead: user._id, // El ID del usuario
          deathDate: req.body.deathDate,
          fatherName: req.body.fatherName,
          motherName: req.body.motherName,
          civilStatus: req.body.civilStatus,
          cemeteryName: req.body.cemeteryName,
          funeralDate: req.body.funeralDate || defaultFuneralDate
        };
  
        const newDeath = new Death(finalDeathData);
        const saveDeath = await newDeath.save();
        res.status(201).json(saveDeath);
  
      } catch (error) {
        if (error.code === 11000) { 
          return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: error.message });
        }
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