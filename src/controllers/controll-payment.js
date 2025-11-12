const Payment = require('../models/payment');
const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const MassSchedule = require('../models/massSchedule');
const userModel = require('../models/user');
const crypto = require('crypto');

// ⏱️ Tiempo de expiración de pagos pendientes (en minutos)
const PAYMENT_EXPIRATION_MINUTES = 2;

// Modo de pruebas ePayco (normalizado)
const testMode = String(process.env.EPAYCO_P_TESTING || '').toLowerCase() === 'true';

// 🔧 Generar referencia única
const generateReference = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9).toUpperCase();
  return `PAR${timestamp}${random}`;
};

// 📋 Mapear tipo de documento
const mapDocumentType = (documentTypeName) => {
  const typeMap = {
    'Cédula de Ciudadanía': 'CC',
    'Cedula de Ciudadania': 'CC',
    'CC': 'CC',
    'Tarjeta de Identidad': 'TI',
    'TI': 'TI',
    'Cédula de Extranjería': 'CE',
    'CE': 'CE',
    'Pasaporte': 'PP',
    'PPN': 'PP',
    'NIT': 'NIT',
  };
  return typeMap[documentTypeName] || 'CC';
};

/**
 * 🧹 Limpiar pagos pendientes expirados
 * Esta función se ejecuta antes de crear un nuevo pago
 */
const cleanExpiredPendingPayments = async (serviceId, serviceType) => {
  try {
    // Buscar pagos pendientes expirados para este servicio (usar expiresAt cuando esté disponible)
    const now = new Date();
    const expiredPayments = await Payment.find({
      serviceId,
      serviceType,
      status: 'pending',
      expiresAt: { $lt: now }
    });

    if (expiredPayments.length > 0) {
      console.log(`🧹 Limpiando ${expiredPayments.length} pago(s) pendiente(s) expirado(s)...`);
      
      // Actualizar estado a 'expired'
      await Payment.updateMany(
        {
          serviceId,
          serviceType,
          status: 'pending',
          expiresAt: { $lt: now }
        },
        {
          $set: {
            status: 'expired',
            expiredAt: new Date()
          }
        }
      );

      // Si son pagos de tipo 'mass', liberar las reservas en MassSchedule asociadas a esas solicitudes
      try {
        for (const p of expiredPayments) {
          if (p.serviceType === 'mass' && p.serviceId) {
            // Buscar la solicitud de misa y liberar el slot reservado si corresponde
            const reqId = p.serviceId;
            await MassSchedule.updateMany(
              { 'timeSlots.reservedBy': reqId },
              {
                $set: {
                  'timeSlots.$.status': 'Libre',
                  'timeSlots.$.available': true,
                  'timeSlots.$.reservedBy': null,
                  'timeSlots.$.reservedUntil': null
                }
              }
            );
            // También opcionalmente actualizar la solicitud de misa a 'Expirada' si aplica
            await RequestMass.findByIdAndUpdate(reqId, { status: 'Expirada' }).catch(() => {});
          }
        }
      } catch (err) {
        console.error('❌ Error liberando reservas tras expiración de pagos:', err);
      }

      console.log('✅ Pagos expirados limpiados correctamente');
    }

    return expiredPayments.length;
  } catch (error) {
    console.error('❌ Error al limpiar pagos expirados:', error);
    return 0;
  }
};

/**
 * 💳 Crear pago y devolver datos para ePayco
 */
const createPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { serviceType, serviceId, amount, description, phone, address } = req.body;

    // ✅ Validaciones
    if (!serviceType || !['mass', 'certificate'].includes(serviceType)) {
      return res.status(400).json({ error: 'Tipo de servicio inválido' });
    }

    if (!serviceId) {
      return res.status(400).json({ error: 'ID de servicio requerido' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Monto inválido' });
    }

    // 💰 Validar monto mínimo
    if (amount < 5000) {
      return res.status(400).json({
        error: 'Monto muy bajo',
        details: { message: 'El monto mínimo para procesar un pago es de $5,000 COP' }
      });
    }

    // 📱 Validar teléfono y dirección
    if (!phone || !/^[0-9]{10}$/.test(phone.replace(/\D/g, ''))) {
      return res.status(400).json({
        error: 'Teléfono inválido',
        details: { message: 'El teléfono debe tener 10 dígitos numéricos' }
      });
    }

    if (!address || address.trim().length < 10) {
      return res.status(400).json({
        error: 'Dirección requerida',
        details: { message: 'La dirección debe tener al menos 10 caracteres' }
      });
    }

    // 🧹 LIMPIAR PAGOS PENDIENTES EXPIRADOS PRIMERO
    await cleanExpiredPendingPayments(serviceId, serviceType);

    // 🔍 Verificar que el servicio existe y pertenece al usuario
    let service;
    let onModel;

    if (serviceType === 'mass') {
      service = await RequestMass.findOne({ _id: serviceId, applicant: userId });
      onModel = 'RequestMass';

      if (!service) {
        return res.status(404).json({ error: 'Solicitud de misa no encontrada o no te pertenece' });
      }

      if (service.status === 'Confirmada') {
        return res.status(400).json({ error: 'Esta solicitud ya fue confirmada' });
      }

    } else if (serviceType === 'certificate') {
      service = await RequestDeparture.findOne({ _id: serviceId, applicant: userId });
      onModel = 'RequestDeparture';

      if (!service) {
        return res.status(404).json({ error: 'Solicitud de partida no encontrada o no te pertenece' });
      }

      if (service.status === 'Enviada') {
        return res.status(400).json({ error: 'Esta solicitud ya fue procesada' });
      }
    }

    // 🔍 Verificar que no exista ya un pago pendiente o aprobado VÁLIDO (no expirado)
    const now = new Date();
    const existingPayment = await Payment.findOne({
      serviceId,
      serviceType,
      status: { $in: ['pending', 'approved'] },
      // Validar que si es pending, no esté expirado (usando expiresAt)
      $or: [
        { status: 'approved' },
        { 
          status: 'pending',
          expiresAt: { $gte: now }
        }
      ]
    });

    if (existingPayment) {
      return res.status(400).json({
        error: existingPayment.status === 'approved' 
          ? 'Ya existe un pago aprobado para este servicio'
          : 'Ya tienes un pago pendiente reciente. Por favor, complétalo o espera a que expire.',
        payment: existingPayment,
        expiresIn: existingPayment.status === 'pending' 
          ? Math.ceil((existingPayment.expiresAt.getTime() - Date.now()) / 1000 / 60)
          : null
      });
    }

    // 👤 Obtener datos del usuario
    const user = await userModel.findById(userId).populate('typeDocument');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // ✅ Validar campos obligatorios del usuario
    const validationErrors = [];

    if (!user.mail || !user.mail.includes('@')) {
      validationErrors.push('email válido');
    }

    if (!user.documentNumber || user.documentNumber.toString().length < 5) {
      validationErrors.push('número de documento');
    }

    if (!user.name || !user.lastName) {
      validationErrors.push('nombre completo');
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Perfil incompleto',
        details: { message: `Por favor actualiza tu perfil con: ${validationErrors.join(', ')}` },
        missingFields: validationErrors
      });
    }

    // 📱 Limpiar teléfono y dirección
    const phoneNumber = phone.replace(/[^0-9]/g, '').substring(0, 10);
    const userAddress = address
      .trim()
      .replace(/[^\w\s,.-áéíóúñÁÉÍÓÚÑ]/g, '')
      .substring(0, 100);

    // 🔒 Generar referencia única
    const referenceCode = generateReference();

    // 💾 Crear registro de pago en BD
    const newPayment = new Payment({
      userId,
      serviceType,
      serviceId,
      onModel,
      amount,
      referenceCode,
      description: description || `Pago por ${serviceType === 'mass' ? 'solicitud de misa' : 'certificado de partida'}`,
      status: 'pending',
      paymentMethod: 'epayco',
      expiresAt: new Date(Date.now() + PAYMENT_EXPIRATION_MINUTES * 60 * 1000), // Agregar fecha de expiración
      payerInfo: {
        name: `${user.name} ${user.lastName}`,
        email: user.mail,
        documentType: user.typeDocument?.document_type_name || 'CC',
        documentNumber: user.documentNumber,
      }
    });

    await newPayment.save();

    // 📋 Mapear tipo de documento
    const mappedDocType = mapDocumentType(user.typeDocument?.document_type_name);

  // 🔑 Variables de entorno
  const publicKey = process.env.EPAYCO_P_PUBLIC_KEY;
  const privateKey = process.env.EPAYCO_P_KEY;

    if (!publicKey) {
      console.error('❌ EPAYCO_P_PUBLIC_KEY no configurada');
      return res.status(500).json({
        error: 'Error de configuración del sistema de pagos',
        details: { message: 'Contacte al administrador - PUBLIC_KEY no configurada' }
      });
    }

    console.log('🔑 Configuración ePayco:', {
      publicKey: publicKey.substring(0, 10) + '...',
      privateKey: privateKey ? 'Configurada' : '❌ NO configurada',
      testMode,
      paymentExpiresIn: PAYMENT_EXPIRATION_MINUTES + ' minutos'
    });

    // 📦 DATOS PARA EPAYCO
    const epaycoData = {
      publicKey: publicKey,
      test: testMode ? 'true' : 'false',

      name: newPayment.description,
      description: newPayment.description,
      invoice: referenceCode,
      currency: 'cop',
      amount: amount.toString(),
      taxBase: '0',
      tax: '0',

      country: 'co',
      lang: 'es',

      external: 'true',
      responseUrl: `${process.env.FRONTEND_URL}/payment/response?invoice=${referenceCode}`,
      confirmationUrl: `${process.env.BACKEND_URL}/api/payment/confirm`,

      name_billing: `${user.name} ${user.lastName}`.trim(),
      email_billing: user.mail.trim(),
      mobilephone_billing: phoneNumber,
      address_billing: userAddress,
      type_doc_billing: mappedDocType,
      number_doc_billing: user.documentNumber.toString().replace(/[^\w]/g, ''),

      extra1: userId.toString(),
      extra2: serviceType,
      extra3: serviceId.toString(),

      methodsDisable: JSON.stringify([]),
    };

    console.log('✅ Pago creado con expiración:', {
      invoice: referenceCode,
      expiresAt: newPayment.expiresAt,
      expiresInMinutes: PAYMENT_EXPIRATION_MINUTES
    });

    // ✅ Retornar los datos para el frontend
    return res.status(201).json({
      success: true,
      message: 'Pago creado exitosamente',
      payment: {
        id: newPayment._id,
        referenceCode: newPayment.referenceCode,
        amount: newPayment.amount,
        description: newPayment.description,
        status: newPayment.status,
        expiresAt: newPayment.expiresAt,
        expiresInMinutes: PAYMENT_EXPIRATION_MINUTES
      },
      epaycoData: epaycoData,
    });

  } catch (error) {
    console.error('💥 Error en createPayment:', error);

    res.status(500).json({
      error: 'Error al crear el pago',
      details: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 3) : undefined
      }
    });
  }
};

/**
 * ✅ Confirmar pago - Webhook de ePayco
 */
const confirmPayment = async (req, res) => {
  try {
    console.log('📨 Webhook de ePayco recibido:', JSON.stringify(req.body, null, 2));

    const {
      x_cust_id_cliente,
      x_ref_payco,
      x_id_invoice,
      x_transaction_id,
      x_amount,
      x_currency_code,
      x_signature,
      x_cod_response,
      x_response,
      x_approval_code,
      x_franchise,
      x_bank_name,
      x_transaction_date,
      x_extra1,
      x_extra2,
      x_extra3,
    } = req.body;

    // 🔍 Buscar el pago por referencia
    const payment = await Payment.findOne({ referenceCode: x_id_invoice });

    if (!payment) {
      console.error('❌ Pago no encontrado con referencia:', x_id_invoice);
      return res.status(200).send('OK');
    }

    // 🔐 Validar firma (solo en producción)
    const pKey = process.env.EPAYCO_P_KEY;

    // Validar que el x_cust_id_cliente coincida con la configuración (si está definida)
    const expectedCustId = process.env.EPAYCO_P_CUST_ID_CLIENTE;
    if (expectedCustId && x_cust_id_cliente && expectedCustId.toString() !== x_cust_id_cliente.toString()) {
      console.error('❌ x_cust_id_cliente no coincide con la configuración. Posible petición maliciosa.');
      return res.status(200).send('OK');
    }

    if (pKey && !testMode) {
      const expectedSignature = crypto
        .createHash('sha256')
        .update(`${x_cust_id_cliente}^${pKey}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`)
        .digest('hex');

      console.log('🔐 Validación de firma:', {
        esperada: expectedSignature,
        recibida: x_signature,
        coincide: expectedSignature === x_signature
      });

      if (expectedSignature !== x_signature) {
        console.error('❌ Firma inválida - Posible fraude');
        return res.status(200).send('OK');
      }
    } else {
      console.warn('⚠️ Validación de firma omitida (modo prueba)');
    }

    // 📝 Actualizar datos del pago
    payment.epaycoReference = x_ref_payco;
    payment.transactionId = x_transaction_id;
    payment.epaycoData = {
      franchise: x_franchise,
      bank: x_bank_name,
      receipt: x_ref_payco,
      authorization: x_approval_code,
      responseCode: x_cod_response,
      responseMessage: x_response,
      transactionDate: x_transaction_date ? new Date(x_transaction_date) : new Date(),
    };

    // 🎯 Actualizar estado según respuesta
    const responseCode = x_cod_response?.toString();

    if (responseCode === '1') {
      payment.status = 'approved';
      payment.confirmedAt = new Date();

      // 📄 Actualizar el servicio relacionado
      if (payment.serviceType === 'mass') {
        const updatedReq = await RequestMass.findByIdAndUpdate(payment.serviceId, {
          status: 'Confirmada',
        }, { new: true });

        // Actualizar el schedule: convertir la reserva temporal en ocupada
        try {
          if (updatedReq) {
            await MassSchedule.updateOne(
              { date: updatedReq.date, 'timeSlots.time': updatedReq.time, 'timeSlots.reservedBy': updatedReq._id },
              {
                $set: {
                  'timeSlots.$.status': 'Ocupado',
                  'timeSlots.$.available': false,
                  'timeSlots.$.reservedBy': null,
                  'timeSlots.$.reservedUntil': null
                }
              }
            );
          }
        } catch (err) {
          console.error('❌ Error actualizando MassSchedule tras confirmación:', err);
        }

        console.log('✅ Solicitud de misa confirmada:', payment.serviceId);
      } else if (payment.serviceType === 'certificate') {
        await RequestDeparture.findByIdAndUpdate(payment.serviceId, {
          status: 'Pendiente',
        });
        console.log('✅ Solicitud de partida actualizada:', payment.serviceId);
      }

    } else if (responseCode === '2') {
      payment.status = 'rejected';
      console.log('❌ Pago rechazado:', x_response);
    } else if (responseCode === '3') {
      payment.status = 'pending';
      console.log('⏳ Pago pendiente');
    } else {
      payment.status = 'failed';
      console.log('💥 Pago fallido');
    }

    await payment.save();

    console.log('✅ Pago actualizado correctamente:', {
      id: payment._id,
      status: payment.status,
      referenceCode: payment.referenceCode
    });

    res.status(200).send('OK');

  } catch (error) {
    console.error('💥 Error en confirmPayment:', error);
    res.status(200).send('OK');
  }
};

/**
 * 📋 Obtener historial de pagos
 */
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const payments = await Payment.find({ userId })
      .populate('serviceId')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      payments,
    });

  } catch (error) {
    console.error('💥 Error en getPaymentHistory:', error);
    res.status(500).json({
      error: 'Error al obtener historial',
      details: { message: error.message }
    });
  }
};

/**
 * 🔍 Consultar un pago específico
 */
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findOne({ _id: id, userId })
      .populate('serviceId')
      .lean();

    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.status(200).json({
      success: true,
      payment,
    });

  } catch (error) {
    console.error('💥 Error en getPaymentById:', error);
    res.status(500).json({
      error: 'Error al consultar el pago',
      details: { message: error.message }
    });
  }
};

/**
 * 🔍 Verificar estado de pago por referencia
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { referenceCode } = req.params;
    const userId = req.user._id;

    const payment = await Payment.findOne({ referenceCode, userId })
      .select('status amount referenceCode epaycoData confirmedAt')
      .lean();

    if (!payment) {
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    res.status(200).json({
      success: true,
      payment,
    });

  } catch (error) {
    console.error('💥 Error en getPaymentStatus:', error);
    res.status(500).json({
      error: 'Error al consultar estado del pago',
      details: { message: error.message }
    });
  }
};



const adminCreateCashPayment = async (req, res) => {
  try {
    const { 
      userId, 
      serviceType, 
      serviceId, 
      amount, 
      description,
      payerInfo // Objeto con { name, email, phone, documentType, documentNumber }
    } = req.body;
    const adminUserId = req.user._id; // ID de la secretaria que está registrando

    // 1. Validaciones básicas
    if (!userId || !serviceType || !serviceId || !amount || !description) {
      return res.status(400).json({ error: 'Faltan datos (userId, serviceType, serviceId, amount, description)' });
    }
    
    const onModel = serviceType === 'mass' ? 'RequestMass' : 'RequestDeparture';

    // 2. Generar una referencia única
    const referenceCode = generateReference();

    // 3. Crear el registro de pago
    const newPayment = new Payment({
      userId,
      serviceType,
      serviceId,
      onModel,
      amount,
      referenceCode,
      description,
      status: 'approved', // ✨ Se aprueba inmediatamente
      paymentMethod: 'cash_admin', // Método especial para diferenciarlo de ePayco
      confirmedAt: new Date(), // Se confirma al instante
      expiresAt: null, // No expira
      
      // Información del pagador (si se pasó)
      payerInfo: payerInfo || {},

      // Datos "simulados" de ePayco para consistencia (opcional)
      epaycoData: {
        franchise: 'Efectivo (Admin)',
        bank: 'Caja Parroquial',
        responseMessage: 'Aprobada (Registro Manual)',
        authorization: `ADMIN-${adminUserId}`,
        transactionDate: new Date(),
      },
    });

    await newPayment.save();

    console.log('✅ Pago manual (admin) creado:', newPayment.referenceCode);
    res.status(201).json({ success: true, payment: newPayment });

  } catch (error) {
    console.error('💥 Error en adminCreateCashPayment:', error);
    res.status(500).json({
      error: 'Error al crear el pago manual',
      details: { message: error.message }
    });
  }
};

module.exports = {
  createPayment,
  confirmPayment,
  getPaymentHistory,
  getPaymentById,
  getPaymentStatus,
  adminCreateCashPayment,
  generateReference,
};