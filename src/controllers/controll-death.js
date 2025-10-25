const Death = require('../models/death'); 
const User = require('../models/user');

module.exports = {
  // Obtener todas las defunciones
  getAllDeaths: async (req, res) => {
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
      // Verificar que la fecha de defunción no sea futura
      const deathDate = new Date(req.body.deathDate);
      const currentDate = new Date();
      if (deathDate > currentDate) {
        return res.status(400).json({ message: "La fecha de defunción no puede ser futura" });
      }

      // Verificar si ya existe un registro de defunción para este número de documento
      const existingDeath = await Death.findOne({ "dead.documentNumber": req.body.documentNumber });
      if (existingDeath) {
        return res.status(400).json({ message: "Ya existe un registro de defunción para este número de documento" });
      }

      // Buscar al usuario fallecido por su número de documento
      const user = await User.findOne({ documentNumber: req.body.documentNumber });
      if (!user) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Calcular la fecha del funeral por defecto (dos días después de deathDate)
      const defaultFuneralDate = new Date(deathDate);
      defaultFuneralDate.setDate(defaultFuneralDate.getDate() + 2);

      // Crear un nuevo objeto de defunción, reemplazando el número de documento con el ObjectId del usuario
      const deathData = {
        ...req.body,
        dead: user._id,  // Asignar el ObjectId del usuario fallecido
        funeralDate: req.body.funeralDate || defaultFuneralDate  // Asignar la fecha del funeral por defecto si no se proporciona
      };
      delete deathData.documentNumber;  // Eliminar documentNumber de los datos

      const newDeath = new Death(deathData);
      const saveDeath = await newDeath.save();
      res.status(201).json(saveDeath);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  // Controlador para obtener una defunción por número de documento del usuario
  getDeathByDocumentNumber: async (req, res) => {
    try {
      // Primero, buscar el usuario por su número de documento
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Luego, buscar la defunción usando el ID del usuario
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
    try {
      // Primero, buscar el usuario por su número de documento
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Luego, buscar y actualizar la defunción usando el ID del usuario
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
    try {
      // Primero, buscar el usuario por su número de documento
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      // Luego, buscar y eliminar la defunción usando el ID del usuario
      const deletedDeath = await Death.findOneAndDelete({ dead: user._id });
      
      if (!deletedDeath) {
        return res.status(404).json({ message: 'Defunción no encontrada para eliminar' });
      }
      
      res.json({ message: 'Defunción eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
};
