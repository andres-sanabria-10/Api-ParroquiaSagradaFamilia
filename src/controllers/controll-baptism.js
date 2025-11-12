const Baptism = require('../models/baptism');
const User = require('../models/user');
const { encrypt } = require('../helpers/handleBcrypt');
const emailService = require('../services/emailService');
const Payment = require('../models/payment'); // <-- Importar Payment
const { generateReference } = require('../controllers/controll-payment'); // <-- Importar generateReference
const RequestDeparture = require('../models/requestDeparture'); // <-- Importar el modelo de Solicitud

module.exports = {

  // --- 1. createBaptism (SIN lógica de pago) ---
  createBaptism: async (req, res) => {
        try {
          // Validación de Fecha
          const baptismDate = new Date(req.body.baptismDate);
          const currentDate = new Date();
          if (baptismDate > currentDate) {
            return res.status(400).json({ message: "La fecha de bautismo no puede ser futura" });
          }
    
          // Buscar o crear al usuario
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
    
          // Preparar y guardar la partida
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
          res.status(201).json(saveBaptism); // Devolvemos solo el bautismo
    
        } catch (error) {
          if (error.code === 11000) { 
            return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: error.message });
          }
          res.status(500).json({ message: error.message });
        }
      },

  // --- 2. sendBaptismByEmail (CON lógica de pago) ---
  // --- ✨ 'sendBaptismByEmail' CORREGIDA (SIN req.user) ---
  sendBaptismByEmail: async (req, res) => {
      const { documentNumber, sendToEmail } = req.body;
  
      if (!documentNumber || !sendToEmail) {
        return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
      }
  
      try {
        // 1. Buscamos el usuario y la partida de bautismo
        const user = await User.findOne({ documentNumber: documentNumber });
        if (!user) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
  
        const baptism = await Baptism.findOne({ baptized: user._id }).populate('baptized');
        if (!baptism) {
          return res.status(404).json({ message: 'Bautismo no encontrado para este usuario' });
        }
  
        // 2. (Opción B) Creamos una "Solicitud de Partida" 
        const newDepartureRequest = new RequestDeparture({
          applicant: user._id,
          departureType: 'Baptism',
          status: 'Enviada', 
          requestDate: new Date(),
          departureId: baptism._id // <-- ✨ ¡AQUÍ ESTÁ LA CORRECCIÓN!
        });
        const savedRequest = await newDepartureRequest.save();
  
        // 3. Creamos el registro de Pago Aprobado
        const amount = 20000; // OJO: Define el costo
        const description = `Pago (en efectivo) por Partida de Bautismo: ${user.name} ${user.lastName}`;
  
        const newPayment = new Payment({
          userId: user._id,
          serviceType: 'certificate',
          serviceId: savedRequest._id, 
          onModel: 'RequestDeparture', 
          amount: amount, 
          referenceCode: generateReference(),
          description: description,
          status: 'approved', 
          paymentMethod: 'cash_admin', 
          confirmedAt: new Date(),
          payerInfo: { name: `${user.name} ${user.lastName}`, email: sendToEmail, documentNumber: user.documentNumber },
          epaycoData: {
            franchise: 'Efectivo (Admin)',
            bank: 'Caja Parroquial',
            responseMessage: 'Aprobada (Registro Manual)',
            authorization: 'ADMIN-MANUAL',
            transactionDate: new Date(),
          },
        });
        await newPayment.save();
        
        // 4. Creamos los datos para la plantilla del email
        const requestData = {
          departureType: 'Baptism', 
          applicant: { name: user.name, mail: sendToEmail }
        };
        
        // 5. Enviamos el correo
        await emailService.sendDepartureDocument(requestData, baptism);
        
        console.log('✅ Partida enviada y Pago Manual creado:', newPayment.referenceCode);
  
        // 6. Éxito
        res.status(200).json({ 
          message: `Partida de bautismo enviada a ${sendToEmail} y pago registrado.`,
          payment: newPayment
        });
  
      } catch (error) {
        console.error('Error al enviar la partida de bautismo:', error);
        res.status(500).json({ message: "Error interno del servidor", error: error.message });
      }
    },


  

  // --- El resto de tus funciones CRUD (getAll, get, update, delete) ---
  getAllBaptisms: async (req, res) => {
    try {
      const baptisms = await Baptism.find().populate({
        path: 'baptized',
        select: 'name lastName documentNumber mail role birthdate typeDocument' 
      });
      res.json(baptisms);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
  getBaptismByDocumentNumber: async (req, res) => {
    try {
      const user = await User.findOne({ documentNumber: req.params.documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      const baptism = await Baptism.findOne({ baptized: user._id }).populate({
        path: 'baptized',
        select: 'name lastName documentNumber mail role birthdate typeDocument'
      });
      if (!baptism) {
        return res.status(404).json({ message: 'Bautismo no encontrado para este usuario' });
      }
      res.json(baptism);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },
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
  }
};