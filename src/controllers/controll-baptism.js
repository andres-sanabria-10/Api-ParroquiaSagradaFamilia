const Baptism = require('../models/baptism');
const User = require('../models/user');
const { encrypt } = require('../helpers/handleBcrypt');

// --- ✨ DEPENDENCIAS ELIMINADAS ---
// Ya no necesitamos 'path', 'fs', ni 'pdfGenerator' aquí.
const emailService = require('../services/emailService');   // Solo necesitamos este


module.exports = {

  // Controlador para crear un nuevo bautismo
  createBaptism: async (req, res) => {
        try {
          const baptismDate = new Date(req.body.baptismDate);
          const currentDate = new Date();
          if (baptismDate > currentDate) {
            return res.status(400).json({ message: "La fecha de bautismo no puede ser futura" });
          }
    
          let user = await User.findOne({ documentNumber: req.body.documentNumber });
    
          if (!user) {
            const { name, lastName, mail, birthdate, documentNumber, typeDocument } = req.body;
            if (!name || !lastName || !mail || !birthdate || !documentNumber || !typeDocument) {
              return res.status(400).json({ message: "Faltan datos del bautizado (incluyendo tipo de doc.) para crear el nuevo usuario." });
            }
            const tempPassword = await encrypt(documentNumber);
            const newUser = new User({ name, lastName, mail, birthdate, documentNumber, typeDocument, password: tempPassword, role: 'Usuario' });
            user = await newUser.save();
          }
    
          const finalBaptismData = {
            baptized: user._id,
            baptismDate: req.body.baptismDate,
            placeBirth: req.body.placeBirth,
            fatherName: req.body.fatherName,
            motherName: req.body.motherName,
            godfather1: req.body.godfather1,
            godfather2: req.body.godfather2,
          };
    
          const newBaptism = new Baptism(finalBaptismData);
          const saveBaptism = await newBaptism.save();
          res.status(201).json(saveBaptism);
    
        } catch (error) {
          if (error.code === 11000) { 
            return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: error.message });
          }
          res.status(500).json({ message: error.message });
        }
      },

  // Controlador para obtener todos los bautismos
  getAllBaptisms: async (req, res) => {
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

  // --- ✨ FUNCIÓN `sendBaptismByEmail` REESCRITA ---
  sendBaptismByEmail: async (req, res) => {
    // 1. Obtenemos el DNI y el correo del cuerpo de la solicitud
    const { documentNumber, sendToEmail } = req.body;

    if (!documentNumber || !sendToEmail) {
      return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
    }

    try {
      // 2. Buscamos el bautismo
      const user = await User.findOne({ documentNumber: documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const baptism = await Baptism.findOne({ baptized: user._id }).populate('baptized');
      if (!baptism) {
        return res.status(404).json({ message: 'Bautismo no encontrado para este usuario' });
      }

      // 3. Creamos el objeto 'requestData' que tu servicio de email espera
      const requestData = {
        departureType: 'Baptism', // Usamos 'Baptism' (B mayúscula) como espera tu pdfGenerator
        applicant: {
          name: baptism.baptized.name,
          mail: sendToEmail // ✨ Aquí ponemos el email que la secretaria ingresó
        }
      };
      
      // 4. Llamamos a la función correcta de tu servicio
      await emailService.sendDepartureDocument(requestData, baptism);

      // 5. Enviar respuesta de éxito
      res.status(200).json({ message: `Partida de bautismo enviada exitosamente a ${sendToEmail}` });

    } catch (error) {
      console.error('Error al enviar la partida de bautismo:', error);
      res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  }
};