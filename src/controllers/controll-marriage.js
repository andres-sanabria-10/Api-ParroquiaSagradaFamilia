const Marriage = require('../models/marriage'); 
const User = require('../models/user')


module.exports = {

// Obtener todos los registros de matrimonio
getAllMarriages : async (req, res) => {
  try {
    const marriages = await Marriage.find().populate([
      {
        path: 'husband',
        select: 'name lastName documentNumber mail role'
      },
      {
        path: 'wife',
        select: 'name lastName documentNumber mail role'
      }
    ]);
    res.json(marriages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
},

// Crear un nuevo registro de matrimonio
createMarriage: async (req, res) => {
  try {
    // Validar que los documentos del esposo y la esposa sean diferentes
    if (req.body.husbandDocumentNumber === req.body.wifeDocumentNumber) {
      return res.status(400).json({ message: "El número de documento del esposo y la esposa no puede ser el mismo" });
    }

    // Buscar al esposo por su número de documento
    const husband = await User.findOne({ documentNumber: req.body.husbandDocumentNumber });
    if (!husband) {
      return res.status(404).json({ message: "Esposo no encontrado" });
    }

    // Buscar a la esposa por su número de documento
    const wife = await User.findOne({ documentNumber: req.body.wifeDocumentNumber });
    if (!wife) {
      return res.status(404).json({ message: "Esposa no encontrada" });
    }

    // Crear un nuevo objeto de matrimonio, reemplazando los números de documento con los ObjectId de los usuarios
    const marriageData = {
      ...req.body,
      husband: husband._id,
      wife: wife._id
    };
    
    // Eliminar los números de documento del objeto de datos
    delete marriageData.husbandDocumentNumber;
    delete marriageData.wifeDocumentNumber;

    const newMarriage = new Marriage(marriageData);
    const saveMarriage = await newMarriage.save();
    res.status(201).json(saveMarriage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Obtener un registro de matrimonio por número de documento del esposo o esposa
getMarriageByDocumentNumber: async (req, res) => {
  try {
    // Buscar al usuario por su número de documento
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Buscar el matrimonio usando el ID del usuario
    const marriage = await Marriage.findOne({ 
      $or: [
        { husband: user._id },
        { wife: user._id }
      ]
    }).populate([
      {
        path: 'husband',
        select: 'name lastName documentNumber mail role'
      },
      {
        path: 'wife',
        select: 'name lastName documentNumber mail role'
      }
    ]);
    
    if (!marriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado' });
    }

    res.json(marriage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Actualizar un registro de matrimonio por número de documento del esposo o esposa
updateMarriageByDocumentNumber: async (req, res) => {
  try {
    // Buscar al usuario por su número de documento
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Buscar y actualizar el matrimonio usando el ID del usuario
    const updatedMarriage = await Marriage.findOneAndUpdate(
      { 
        $or: [
          { husband: user._id },
          { wife: user._id }
        ]
      },
      req.body,
      { new: true }
    ).populate([
      {
        path: 'husband',
        select: 'name lastName documentNumber mail role'
      },
      {
        path: 'wife',
        select: 'name lastName documentNumber mail role'
      }
    ]);
    
    if (!updatedMarriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado para actualizar' });
    }

    res.json(updatedMarriage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Eliminar un registro de matrimonio por número de documento del esposo o esposa
deleteMarriageByDocumentNumber: async (req, res) => {
  try {
    // Buscar al usuario por su número de documento
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Buscar y eliminar el matrimonio usando el ID del usuario
    const deleteMarriage = await Marriage.findOneAndDelete({ 
      $or: [
        { husband: user._id },
        { wife: user._id }
      ]
    });
    
    if (!deleteMarriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado para eliminar' });
    }

    res.json({ message: 'Matrimonio eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
};
