const Confirmation = require('../models/confirmation');
const User = require('../models/user');
const { encrypt } = require('../helpers/handleBcrypt');
const emailService = require('../services/emailService'); 

module.exports = {
  // Obtener todas las confirmaciones
  getAllConfirmations: async (req, res) => {
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
      try {
        // 1. Validación de Fecha
        const confirmationDate = new Date(req.body.confirmationDate);
        const currentDate = new Date();
        if (confirmationDate > currentDate) {
          return res.status(400).json({ message: "La fecha de confirmación no puede ser futura" });
        }
  
        // 2. Buscar al usuario por DNI
        let user = await User.findOne({ documentNumber: req.body.documentNumber });
  
        // 3. Si el usuario NO existe, lo creamos
        if (!user) {
          // Obtenemos los datos necesarios del formulario
          const { name, lastName, mail, birthdate, documentNumber } = req.body;
          if (!name || !lastName || !mail || !birthdate || !documentNumber) {
            return res.status(400).json({ message: "Faltan datos del confirmado (nombre, apellido, email, fecha de nac.) para crear el nuevo usuario." });
          }
          
          // Creamos una contraseña temporal
          const tempPassword = await encrypt(documentNumber);
  
          const newUser = new User({
            name,
            lastName,
            mail,
            birthdate,
            documentNumber,
            password: tempPassword,
            role: 'feligres' // Asignamos rol por defecto
          });
  
          // Guardamos el nuevo usuario
          user = await newUser.save();
        }
  
        // 4. Preparar los datos SÓLO para el modelo Confirmation
        const finalConfirmationData = {
          confirmed: user._id, // El ID del usuario (encontrado o recién creado)
          confirmationDate: req.body.confirmationDate,
          fatherName: req.body.fatherName,
          motherName: req.body.motherName,
          godfather: req.body.godfather,
          baptizedParish: req.body.baptizedParish,
        };
  
        // 5. Guardar la nueva partida de confirmación
        const newConfirmation = new Confirmation(finalConfirmationData);
        const savedConfirmation = await newConfirmation.save();
        res.status(201).json(savedConfirmation);
  
      } catch (error) {
        // Manejamos un error común: si el DNI o el Email ya existen al crear el usuario
        if (error.code === 11000) { 
          return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: error.message });
        }
        res.status(500).json({ message: error.message });
      }
    },

  // Controlador para obtener una confirmación por número de documento del usuario
  getConfirmationByDocumentNumber: async (req, res) => {
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

  // --- ✨ FUNCIÓN `sendConfirmationByEmail` REESCRITA ---
  sendConfirmationByEmail: async (req, res) => {
    // 1. Obtenemos el DNI y el correo del cuerpo de la solicitud
    const { documentNumber, sendToEmail } = req.body;

    if (!documentNumber || !sendToEmail) {
      return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
    }

    try {
      // 2. Buscamos la confirmación (igual que en tu función get)
      const user = await User.findOne({ documentNumber: documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const confirmation = await Confirmation.findOne({ confirmed: user._id }).populate('confirmed');
      if (!confirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para este usuario' });
      }

      // 3. Creamos el objeto 'requestData' que tu servicio de email espera
      const requestData = {
        departureType: 'Confirmation', // Usamos 'Confirmation' (C mayúscula) como espera tu pdfGenerator
        applicant: {
          name: confirmation.confirmed.name,
          mail: sendToEmail // ✨ Aquí ponemos el email que la secretaria ingresó
        }
      };
      
      // 4. Llamamos a la función correcta de tu servicio
      // Le pasamos los dos argumentos que espera: requestData y departureData
      await emailService.sendDepartureDocument(requestData, confirmation);

      // 5. Enviar respuesta de éxito
      res.status(200).json({ message: `Partida de confirmación enviada exitosamente a ${sendToEmail}` });

    } catch (error) {
      console.error('Error al enviar la partida de confirmación:', error);
      res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }
};