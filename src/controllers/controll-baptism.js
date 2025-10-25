const Baptism = require('../models/baptism');
const User = require('../models/user')


module.exports = {

// Controlador para crear un nuevo bautismo
createBaptism: async (req, res) => {
  try {
    // Verificar que la fecha de bautismo no sea futura
    const baptismDate = new Date(req.body.baptismDate);
    const currentDate = new Date();
    if (baptismDate > currentDate) {
      return res.status(400).json({ message: "La fecha de bautismo no puede ser futura" });
    }

    // Buscar el usuario por número de documento
    const user = await User.findOne({ documentNumber: req.body.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Crear un nuevo objeto de bautismo, reemplazando documentNumber con el ObjectId del usuario
    const baptismData = {
      ...req.body,
      baptized: user._id  // Asignar el ObjectId del usuario
    };
    delete baptismData.documentNumber;  // Eliminar documentNumber de los datos

    const newBaptism = new Baptism(baptismData);
    const saveBaptism = await newBaptism.save();
    res.status(201).json(saveBaptism);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Controlador para obtener todos los bautismos
getAllBaptisms: async (req, res) => {
  try {
    const baptisms = await Baptism.find().populate({
      path: 'baptized',
      select: 'name lastName documentNumber mail role' // Solo incluimos estos campos
    });

    res.json(baptisms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Controlador para obtener un bautismo por número de documento del usuario
getBaptismByDocumentNumber: async (req, res) => {
  try {
    // Primero, buscar el usuario por su número de documento
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Luego, buscar el bautismo usando el ID del usuario
    const baptism = await Baptism.findOne({ baptized: user._id }).populate({
      path: 'baptized',
      select: 'name lastName documentNumber mail role' // Solo incluimos estos campos
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
  try {
    // Primero, buscar el usuario por su número de documento
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Luego, buscar y actualizar el bautismo usando el ID del usuario
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
  try {
    // Primero, buscar el usuario por su número de documento
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Luego, buscar y eliminar el bautismo usando el ID del usuario
    const deleteBaptism = await Baptism.findOneAndDelete({ baptized: user._id });
    
    if (!deleteBaptism) {
      return res.status(404).json({ message: 'Bautismo no encontrado para eliminar' });
    }
    
    res.json({ message: 'Bautismo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
};
