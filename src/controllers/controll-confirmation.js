const Confirmation = require('../models/confirmation');
const User = require('../models/user');

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
      // Verificar que la fecha de confirmación no sea futura
      const confirmationDate = new Date(req.body.confirmationDate);
      const currentDate = new Date();
      if (confirmationDate > currentDate) {
        return res.status(400).json({ message: "La fecha de confirmación no puede ser futura" });
      }

      // Buscar el usuario por número de documento
      const user = await User.findOne({ documentNumber: req.body.documentNumber });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Crear un nuevo objeto de confirmación, reemplazando documentNumber con el ObjectId del usuario
      const confirmationData = {
        ...req.body,
        confirmed: user._id  // Asignar el ObjectId del usuario
      };
      delete confirmationData.documentNumber;  // Eliminar documentNumber de los datos

      const newConfirmation = new Confirmation(confirmationData);
      const savedConfirmation = await newConfirmation.save();
      res.status(201).json(savedConfirmation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para obtener una confirmación por número de documento del usuario
  getConfirmationByDocumentNumber: async (req, res) => {
    try {
      // Primero, buscar el usuario por su número de documento
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Luego, buscar la confirmación usando el ID del usuario
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
      // Primero, buscar el usuario por su número de documento
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Luego, buscar y actualizar la confirmación usando el ID del usuario
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
      // Primero, buscar el usuario por su número de documento
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Luego, buscar y eliminar la confirmación usando el ID del usuario
      const deletedConfirmation = await Confirmation.findOneAndDelete({ confirmed: user._id });
      
      if (!deletedConfirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para eliminar' });
      }
      
      res.json({ message: 'Confirmación eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};
