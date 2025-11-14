const Payment = require('../models/payment');
const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const MassSchedule = require('../models/massSchedule');
const userModel = require('../models/user');
const crypto = require('crypto');
const mercadoPagoService = require('../services/mercadoPagoService');

// ⏱️ Tiempo de expiración de pagos pendientes (en minutos)
const PAYMENT_EXPIRATION_MINUTES = 2; // ⚠️ Cambiado de 2 a 30 minutos

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
 */
const cleanExpiredPendingPayments = async (serviceId, serviceType) => {
  try {
    const now = new Date();
    const expiredPayments = await Payment.find({
      serviceId,
      serviceType,
      status: 'pending',
      expiresAt: { $lt: now }
    });

    if (expiredPayments.length > 0) {
      console.log(`🧹 Limpiando ${expiredPayments.length} pago(s) pendiente(s) expirado(s)...`);
      
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

      try {
        for (const p of expiredPayments) {
          if (p.serviceType === 'mass' && p.serviceId) {
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
 * 💳 Crear pago y devolver datos para Mercado Pago
 */
const createPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { serviceType, serviceId, amount, description, phone, address } = req.body;

    // ✅ Validar datos de entrada
    if (!serviceType || !serviceId || !amount || !phone || !address) {
      return res.status(400).json({ error: 'Faltan datos requeridos (serviceType, serviceId, amount, phone, address)' });
    }

    // Validar monto mínimo ($5,000 COP)
    if (Number(amount) < 5000) {
      return res.status(400).json({ error: 'Monto mínimo requerido: $5,000 COP' });
    }

    // Validar teléfono (10 dígitos)
    const phoneNumber = phone.replace(/[^0-9]/g, '').substring(0, 10);
    if (phoneNumber.length !== 10) {
      return res.status(400).json({ error: 'Teléfono debe tener 10 dígitos' });
    }

    // 👤 Obtener datos del usuario
    const user = await userModel.findById(userId).populate('typeDocument');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // ✅ Validar campos del usuario
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

    // 📱 Limpiar dirección
    const userAddress = address
      .trim()
      .replace(/[^\w\s,.-áéíóúñÁÉÍÓÚÑ]/g, '')
      .substring(0, 100);

    // 🔒 Generar referencia
    const referenceCode = generateReference();

    // Mapear modelo según serviceType
    const onModel = serviceType === 'mass' ? 'RequestMass' : 'RequestDeparture';

    // 💾 Crear pago (estado 'pending')
    const newPayment = new Payment({
      userId,
      serviceType,
      serviceId,
      onModel,
      amount,
      referenceCode,
      description: description || `Pago por ${serviceType === 'mass' ? 'solicitud de misa' : 'certificado de partida'}`,
      status: 'pending',
      paymentMethod: 'mercadopago',
      expiresAt: new Date(Date.now() + PAYMENT_EXPIRATION_MINUTES * 60 * 1000),
      payerInfo: {
        name: `${user.name} ${user.lastName}`,
        email: user.mail,
        documentType: user.typeDocument?.document_type_name || 'CC',
        documentNumber: user.documentNumber,
      }
    });

    await newPayment.save();

    // ======= Mercado Pago: crear preference y devolver init_point =======
    try {
      const items = [{
        id: newPayment._id.toString(),
        title: newPayment.description,
        quantity: 1,
        unit_price: Number(amount),
        currency_id: 'COP'
      }];

      const payer = {
        email: user.mail,
        name: `${user.name} ${user.lastName}`.trim()
      };

      // Incluir la referencia (invoice) en las back_urls para que el frontend
      // reciba la referencia al volver desde Mercado Pago y pueda consultar el estado
      const back_urls = {
        success: `${process.env.FRONTEND_URL}/payment/response?invoice=${referenceCode}`,
        failure: `${process.env.FRONTEND_URL}/payment/response?invoice=${referenceCode}`,
        pending: `${process.env.FRONTEND_URL}/payment/response?invoice=${referenceCode}`
      };

      const preference = await mercadoPagoService.createPreference({
        items,
        payer,
        back_urls,
        external_reference: referenceCode
      });

      // Guardar referencias del gateway
      newPayment.gatewayReference = preference.id;
      newPayment.gatewayData = {
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
        preference: preference
      };

      await newPayment.save();

      console.log('✅ Pago creado (Mercado Pago):', {
        referenceCode,
        preferenceId: preference.id,
        expiresAt: newPayment.expiresAt
      });

      return res.status(201).json({
        success: true,
        message: 'Pago creado exitosamente (Mercado Pago)',
        payment: {
          id: newPayment._id,
          referenceCode: newPayment.referenceCode,
          amount: newPayment.amount,
          description: newPayment.description,
          status: newPayment.status,
          expiresAt: newPayment.expiresAt,
          expiresInMinutes: PAYMENT_EXPIRATION_MINUTES
        },
        checkout: {
          init_point: preference.init_point,
          preferenceId: preference.id,
          publicKey: process.env.mercado_pago_public_key
        }
      });
    } catch (errMp) {
      console.error('❌ Error creando preference de Mercado Pago:', errMp);
      await Payment.findByIdAndDelete(newPayment._id).catch(() => {});
      return res.status(500).json({ error: 'Error creando preference de pago', details: { message: errMp.message } });
    }

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
 * ✅ Confirmar pago - Webhook de Mercado Pago
 */
const confirmPayment = async (req, res) => {
  try {
    console.log('📨 Webhook recibido:', {
      query: req.query,
      topic: req.query?.topic || req.body?.topic || req.body?.type,
      body: JSON.stringify(req.body, null, 2).substring(0, 500) + '...'
    });

    // Detectar notificaciones de Mercado Pago
    // Pueden venir como: ?topic=payment&id=... o body.data.id o body.id
    const mpId = req.query?.id || req.body?.id || req.body?.data?.id;
    const mpTopic = req.query?.topic || req.body?.topic || req.body?.type;

    if (!mpId && mpTopic !== 'payment') {
      console.warn('⚠️ Webhook sin datos de Mercado Pago válidos');
      return res.status(200).send('OK');
    }

    // Obtener datos del pago desde Mercado Pago API
    const mpPayment = await mercadoPagoService.getPaymentById(mpId);

    if (!mpPayment) {
      console.warn('⚠️ Pago Mercado Pago no encontrado por id:', mpId);
      return res.status(200).send('OK');
    }

    console.log('📦 Pago Mercado Pago obtenido:', {
      id: mpPayment.id,
      status: mpPayment.status,
      external_reference: mpPayment.external_reference
    });

    // Buscar pago en DB por referencia externa (external_reference)
    let payment = await Payment.findOne({ referenceCode: mpPayment.external_reference });

    if (!payment) {
      console.warn('⚠️ No se encontró pago local para notificación MP. external_reference:', mpPayment.external_reference);
      return res.status(200).send('OK');
    }

    // Actualizar transactionId y datos del gateway
    payment.transactionId = mpPayment.id?.toString();
    payment.gatewayData = mpPayment;

    // Mapear estados de Mercado Pago
    const status = mpPayment.status;
    if (status === 'approved') {
      payment.status = 'approved';
      payment.confirmedAt = new Date();

      // 📄 Actualizar servicio asociado
      if (payment.serviceType === 'mass') {
        const updatedReq = await RequestMass.findByIdAndUpdate(
          payment.serviceId,
          { status: 'Confirmada' },
          { new: true }
        );

        try {
          if (updatedReq) {
            // Actualizar slot de misa a Ocupado
            await MassSchedule.updateOne(
              {
                date: updatedReq.date,
                'timeSlots.time': updatedReq.time,
                'timeSlots.reservedBy': updatedReq._id
              },
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
          console.error('❌ Error actualizando MassSchedule (MP):', err);
        }

        console.log('✅ Solicitud de misa confirmada:', payment.serviceId);
      } else if (payment.serviceType === 'certificate') {
        await RequestDeparture.findByIdAndUpdate(
          payment.serviceId,
          { status: 'Pendiente' }
        );
        console.log('✅ Solicitud de partida actualizada:', payment.serviceId);
      }

    } else if (status === 'in_process') {
      payment.status = 'pending';
      console.log('⏳ Pago en procesamiento');
    } else if (status === 'rejected' || status === 'cancelled') {
      payment.status = 'rejected';
      console.log('❌ Pago rechazado');
    } else {
      payment.status = 'failed';
      console.log('💥 Pago fallido:', status);
    }

    await payment.save();

    console.log('✅ Pago actualizado (Mercado Pago):', {
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
      .select('status amount referenceCode gatewayData paymentMethod confirmedAt serviceType')
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
      payerInfo
    } = req.body;
    const adminUserId = req.user._id;

    if (!userId || !serviceType || !serviceId || !amount || !description) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    
    const onModel = serviceType === 'mass' ? 'RequestMass' : 'RequestDeparture';
    const referenceCode = generateReference();

    const newPayment = new Payment({
      userId,
      serviceType,
      serviceId,
      onModel,
      amount,
      referenceCode,
      description,
      status: 'approved',
      paymentMethod: 'cash_admin',
      confirmedAt: new Date(),
      expiresAt: null,
      payerInfo: payerInfo || {},
      gatewayData: {
        paymentMethod: 'Efectivo (Admin)',
        bankOrSource: 'Caja Parroquial',
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



const getAllPayments = async (req, res) => {
    try {
      // Buscamos todos los pagos, ordenados por más reciente
      const payments = await Payment.find()
        .populate('userId', 'name lastName') // Obtenemos el nombre del usuario
        .sort({ createdAt: -1 }) // Los más nuevos primero
        .lean();
  
      // Calculamos el total recaudado (solo de pagos 'approved')
      const totalRevenue = payments
        .filter(p => p.status === 'approved')
        .reduce((sum, p) => sum + p.amount, 0);
  
      res.status(200).json({
        success: true,
        totalRevenue, // Total recaudado
        totalTransactions: payments.length, // Conteo total
        payments, // Lista de pagos
      });
  
    } catch (error) {
      console.error('💥 Error en getAllPayments:', error);
      res.status(500).json({
        error: 'Error al obtener todos los pagos',
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
  getAllPayments,
};