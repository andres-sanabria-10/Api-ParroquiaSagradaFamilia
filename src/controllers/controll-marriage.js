const Marriage = require('../models/marriage'); 
const User = require('../models/user');
const Payment = require('../models/payment'); 
const { encrypt } = require('../helpers/handleBcrypt');
const { generateReference } = require('../controllers/controll-payment');
const emailService = require('../services/emailService');
const RequestDeparture = require('../models/requestDeparture');

module.exports = {

// Obtener todos los registros de matrimonio
getAllMarriages : async (req, res) => {
  // (Tu código existente... se mantiene igual)
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
        const {
          husbandDocumentNumber, husbandName, husbandLastName, husbandMail, husbandBirthdate, husbandTypeDocument,
          wifeDocumentNumber, wifeName, wifeLastName, wifeMail, wifeBirthdate, wifeTypeDocument,
          ...marriageSpecificData 
        } = req.body;
  
        if (husbandDocumentNumber === wifeDocumentNumber) {
          return res.status(400).json({ message: "El número de documento del esposo y la esposa no puede ser el mismo" });
        }
  
        // --- Procesar al Esposo ---
        let husband = await User.findOne({ documentNumber: husbandDocumentNumber });
        if (!husband) {
          if (!husbandName || !husbandLastName || !husbandMail || !husbandBirthdate || !husbandTypeDocument) {
            return res.status(400).json({ message: "Faltan datos del esposo (incluyendo tipo de doc.) para crear el nuevo usuario." });
          }
          const tempPassword = await encrypt(husbandDocumentNumber);
          const newHusband = new User({
            name: husbandName, lastName: husbandLastName, mail: husbandMail, birthdate: husbandBirthdate, 
            documentNumber: husbandDocumentNumber, typeDocument: husbandTypeDocument, 
            password: tempPassword, role: 'Usuario'
          });
          husband = await newHusband.save();
        }
  
        // --- Procesar a la Esposa ---
        let wife = await User.findOne({ documentNumber: wifeDocumentNumber });
        if (!wife) {
          if (!wifeName || !wifeLastName || !wifeMail || !wifeBirthdate || !wifeTypeDocument) {
            return res.status(400).json({ message: "Faltan datos de la esposa (incluyendo tipo de doc.) para crear el nuevo usuario." });
          }
          const tempPassword = await encrypt(wifeDocumentNumber);
          const newWife = new User({
            name: wifeName, lastName: wifeLastName, mail: wifeMail, birthdate: wifeBirthdate,
            documentNumber: wifeDocumentNumber, typeDocument: wifeTypeDocument,
            password: tempPassword, role: 'Usuario'
          });
          wife = await newWife.save();
        }
  
        // Preparar y guardar la partida de matrimonio
        const finalMarriageData = {
          ...marriageSpecificData,
          husband: husband._id,
          wife: wife._id 
        };
  
        const newMarriage = new Marriage(finalMarriageData);
        const saveMarriage = await newMarriage.save();
        res.status(201).json(saveMarriage);
  
      } catch (error) {
        if (error.code === 11000) { 
          return res.status(409).json({ message: "Error de duplicado: El DNI o el correo de uno de los contrayentes ya está registrado.", details: error.message });
        }
        res.status(500).json({ message: error.message });
      }
    },

// Obtener un registro de matrimonio por número de documento
getMarriageByDocumentNumber: async (req, res) => {
  // (Tu código existente... se mantiene igual)
  try {
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const marriage = await Marriage.findOne({ 
      $or: [
        { husband: user._id },
        { wife: user._id }
      ]
    }).populate([
      { path: 'husband', select: 'name lastName documentNumber mail role' },
      { path: 'wife', select: 'name lastName documentNumber mail role' }
    ]);
    if (!marriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado' });
    }
    res.json(marriage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Actualizar un registro de matrimonio
updateMarriageByDocumentNumber: async (req, res) => {
  // (Tu código existente... se mantiene igual)
  try {
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const updatedMarriage = await Marriage.findOneAndUpdate(
      { $or: [{ husband: user._id }, { wife: user._id }] },
      req.body,
      { new: true }
    ).populate(['husband', 'wife']);
    if (!updatedMarriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado para actualizar' });
    }
    res.json(updatedMarriage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// Eliminar un registro de matrimonio
deleteMarriageByDocumentNumber: async (req, res) => {
  // (Tu código existente... se mantiene igual)
  try {
    const user = await User.findOne({ documentNumber: req.params.documentNumber });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    const deleteMarriage = await Marriage.findOneAndDelete({ 
      $or: [{ husband: user._id }, { wife: user._id }]
    });
    if (!deleteMarriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado para eliminar' });
    }
    res.json({ message: 'Matrimonio eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
},

// --- ✨ NUEVO ENDPOINT PARA ENVIAR POR CORREO ---
sendMarriageByEmail: async (req, res) => {
  const { documentNumber, sendToEmail } = req.body;

  if (!documentNumber || !sendToEmail) {
    return res.status(400).json({ message: "Faltan el número de documento o el correo de destino." });
  }

  try {
    // 1. Buscamos el matrimonio
    const user = await User.findOne({ documentNumber: documentNumber });
    if (!user) {
      return res.status(404).json({ message: 'Usuario (esposo) no encontrado' });
    }

    const marriage = await Marriage.findOne({ 
      $or: [ { husband: user._id }, { wife: user._id } ]
    }).populate(['husband', 'wife']);

    if (!marriage) {
      return res.status(404).json({ message: 'Matrimonio no encontrado para este usuario' });
    }
    
    // 2. (Opción B) Crear Solicitud "fantasma"
    const newDepartureRequest = new RequestDeparture({
      applicant: user._id, 
      departureType: 'Marriage',
      status: 'Enviada',
      requestDate: new Date(),
      departureId: marriage._id // <-- ✨ ¡AQUÍ ESTÁ LA CORRECCIÓN!
    });
    const savedRequest = await newDepartureRequest.save();

    // 3. Crear Pago Aprobado
    const amount = 20000; // OJO: Define el costo
    const description = `Pago (en efectivo) por Partida de Matrimonio`;
    
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
      departureType: 'Marriage',
      applicant: {
        name: `${marriage.husband.name} y ${marriage.wife.name}`,
        mail: sendToEmail
      }
    };
    
    // 5. Enviar correo
    await emailService.sendDepartureDocument(requestData, marriage);

    console.log('✅ Partida enviada y Pago Manual creado:', newPayment.referenceCode);

    // 6. Éxito
    res.status(200).json({ 
      message: `Partida de matrimonio enviada a ${sendToEmail} y pago registrado.`,
      payment: newPayment 
    });

  } catch (error) {
    console.error('Error al enviar la partida de matrimonio:', error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
},
};