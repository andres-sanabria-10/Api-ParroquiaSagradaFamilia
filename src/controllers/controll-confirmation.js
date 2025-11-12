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
        const confirmationDate = new Date(req.body.confirmationDate);
        const currentDate = new Date();
        if (confirmationDate > currentDate) {
          return res.status(400).json({ message: "La fecha de confirmación no puede ser futura" });
        }
  
        let user = await User.findOne({ documentNumber: req.body.documentNumber });
  
        if (!user) {
          const { name, lastName, mail, birthdate, documentNumber, typeDocument } = req.body;
          if (!name || !lastName || !mail || !birthdate || !documentNumber || !typeDocument) {
            return res.status(400).json({ message: "Faltan datos del confirmado (incluyendo tipo de doc.) para crear el nuevo usuario." });
          }
          const tempPassword = await encrypt(documentNumber);
          const newUser = new User({ name, lastName, mail, birthdate, documentNumber, typeDocument, password: tempPassword, role: 'Usuario' });
          user = await newUser.save();
        }
  
        const finalConfirmationData = {
          confirmed: user._id,
          confirmationDate: req.body.confirmationDate,
          fatherName: req.body.fatherName,
          motherName: req.body.motherName,
          godfather: req.body.godfather,
          baptizedParish: req.body.baptizedParish,
        };
  
        const newConfirmation = new Confirmation(finalConfirmationData);
        const savedConfirmation = await newConfirmation.save();
        res.status(201).json(savedConfirmation);
  
      } catch (error) {
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

  // --- ✨ 'sendConfirmationByEmail' CORREGIDA (con departureId) ---
  sendConfirmationByEmail: async (req, res) => {
    const { documentNumber, sendToEmail } = req.body;

    if (!documentNumber || !sendToEmail) {
      return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
    }

    try {
      // 1. Buscamos la confirmación
      const user = await User.findOne({ documentNumber: documentNumber });
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      const confirmation = await Confirmation.findOne({ confirmed: user._id }).populate('confirmed');
      if (!confirmation) {
        return res.status(404).json({ message: 'Confirmación no encontrada para este usuario' });
      }

      // 2. (Opción B) Crear Solicitud "fantasma"
      const newDepartureRequest = new RequestDeparture({
        applicant: user._id,
        departureType: 'Confirmation',
        status: 'Enviada',
        requestDate: new Date(),
        departureId: confirmation._id // <-- ✨ ¡AQUÍ ESTÁ LA CORRECCIÓN!
      });
      const savedRequest = await newDepartureRequest.save();

      // 3. Crear Pago Aprobado
      const amount = 20000; // OJO: Define el costo
      const description = `Pago (en efectivo) por Partida de Confirmación: ${user.name} ${user.lastName}`;

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

      // 4. Preparar datos para el email
      const requestData = {
        departureType: 'Confirmation',
        applicant: {
          name: confirmation.confirmed.name,
          mail: sendToEmail
        }
      };
      
      // 5. Enviar correo
      await emailService.sendDepartureDocument(requestData, confirmation);
      
      console.log('✅ Partida enviada y Pago Manual creado:', newPayment.referenceCode);

      // 6. Éxito
      res.status(200).json({ 
        message: `Partida de confirmación enviada a ${sendToEmail} y pago registrado.`,
        payment: newPayment
      });

    } catch (error) {
      console.error('Error al enviar la partida de confirmación:', error);
      res.status(500).json({ message: "Error interno del servidor", error: error.message });
    }
  },
};