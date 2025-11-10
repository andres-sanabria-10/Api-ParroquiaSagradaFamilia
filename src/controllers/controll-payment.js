const Payment = require('../models/payment');
const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const userModel = require('../models/user');
const crypto = require('crypto');

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
    'Pasaporte': 'PPN',
    'NIT': 'NIT',
  };
  return typeMap[documentTypeName] || 'CC';
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
        details: 'El monto mínimo para procesar un pago es de $5,000 COP'
      });
    }

    // 📱 Validar teléfono y dirección (nuevos campos obligatorios)
    if (!phone || phone.length < 10) {
      return res.status(400).json({ 
        error: 'Teléfono requerido',
        details: 'El teléfono debe tener al menos 10 dígitos'
      });
    }

    if (!address || address.trim().length < 10) {
      return res.status(400).json({ 
        error: 'Dirección requerida',
        details: 'La dirección debe tener al menos 10 caracteres'
      });
    }

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

    // 🔍 Verificar que no exista ya un pago pendiente o aprobado
    const existingPayment = await Payment.findOne({
      serviceId,
      serviceType,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingPayment) {
      return res.status(400).json({
        error: 'Ya existe un pago pendiente o aprobado para este servicio',
        payment: existingPayment
      });
    }

    // 👤 Obtener datos del usuario
    const user = await userModel.findById(userId).populate('typeDocument');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // ✅ Validar solo campos REALMENTE obligatorios
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
        details: `Por favor actualiza tu perfil con: ${validationErrors.join(', ')}`,
        missingFields: validationErrors
      });
    }

    // 📱 Usar los valores proporcionados por el usuario (desde el formulario)
    const phoneNumber = phone.replace(/[^0-9]/g, '');
    const userAddress = address.trim();

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

    console.log('👤 Datos del usuario para ePayco:', {
      name: `${user.name} ${user.lastName}`,
      email: user.mail,
      documentType: user.typeDocument?.document_type_name,
      mappedDocType,
      documentNumber: user.documentNumber,
      phone: phoneNumber,
      address: userAddress
    });

    // 🔑 Variables de entorno necesarias
    const publicKey = process.env.EPAYCO_P_PUBLIC_KEY;

    if (!publicKey) {
      console.error('❌ Public Key de ePayco no configurada');
      return res.status(500).json({ 
        error: 'Error de configuración del sistema de pagos',
        details: 'Contacte al administrador'
      });
    }

    console.log('🔑 Public Key:', publicKey);
    console.log('🧪 Modo prueba:', process.env.EPAYCO_P_TESTING === 'true' ? 'SÍ' : 'NO');

    // 📦 DATOS PARA EL CHECKOUT DE EPAYCO
    const paymentData = {
      // Configuración de ePayco
      publicKey: publicKey,
      
      // Datos de la transacción
      invoice: referenceCode,
      description: newPayment.description,
      amount: amount.toString(),
      taxBase: '0',
      tax: '0',
      currency: 'cop',
      country: 'co',
      
      // URLs de respuesta
      responseUrl: `${process.env.FRONTEND_URL}/payment/response`,
      confirmationUrl: `${process.env.BACKEND_URL}/api/payment/confirm`,
      
      // ✅ Información del cliente (usando valores del formulario)
      nameFactura: `${user.name} ${user.lastName}`.trim(),
      emailFactura: user.mail.trim(),
      mobilePhoneFactura: phoneNumber,
      addressFactura: userAddress,
      typeDocFactura: mappedDocType,
      numberDocFactura: user.documentNumber.toString(),
      
      // Extras para identificación
      extra1: userId.toString(),
      extra2: serviceType,
      extra3: serviceId.toString(),
      
      // Configuración
      lang: 'es',
      external: 'false',
      test: process.env.EPAYCO_P_TESTING === 'true' ? 'true' : 'false',
      methodsDisable: '[]',
    };

    console.log('📦 Payment data preparado:', {
      ...paymentData,
      emailFactura: user.mail.replace(/(.{3}).*(@.*)/, '$1***$2'),
      mobilePhoneFactura: phoneNumber.replace(/(.{3}).*(.{2})/, '$1***$2'),
    });

    // ✅ Retornar los datos para que el frontend use el checkout
    return res.status(201).json({
      success: true,
      message: 'Pago creado exitosamente',
      payment: {
        id: newPayment._id,
        referenceCode: newPayment.referenceCode,
        amount: newPayment.amount,
        description: newPayment.description,
        status: newPayment.status,
      },
      epaycoData: paymentData,
    });

  } catch (error) {
    console.error('💥 Error en createPayment:', error);

    let errorMessage = 'Error al crear el pago';
    let errorDetails = {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    };

    res.status(500).json({
      error: errorMessage,
      details: errorDetails
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

    // 🔐 Validar firma
    const pKey = process.env.EPAYCO_P_KEY;
    
    if (pKey) {
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
        console.error('❌ Firma inválida');
        
        if (process.env.EPAYCO_P_TESTING !== 'true') {
          return res.status(200).send('OK');
        } else {
          console.warn('⚠️ Firma inválida pero permitiendo en modo prueba');
        }
      }
    } else {
      console.warn('⚠️ No se puede validar firma - EPAYCO_P_KEY no configurada');
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
    if (x_cod_response === '1' || x_cod_response === 1) {
      payment.status = 'approved';
      payment.confirmedAt = new Date();

      // 📄 Actualizar el servicio relacionado
      if (payment.serviceType === 'mass') {
        await RequestMass.findByIdAndUpdate(payment.serviceId, {
          status: 'Confirmada',
        });
        console.log('✅ Solicitud de misa confirmada:', payment.serviceId);
      } else if (payment.serviceType === 'certificate') {
        await RequestDeparture.findByIdAndUpdate(payment.serviceId, {
          status: 'Pendiente',
        });
        console.log('✅ Solicitud de partida actualizada:', payment.serviceId);
      }

    } else if (x_cod_response === '2' || x_cod_response === 2) {
      payment.status = 'rejected';
      console.log('❌ Pago rechazado:', x_response);
    } else if (x_cod_response === '3' || x_cod_response === 3) {
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
      details: error.message
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
      details: error.message
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
      details: error.message
    });
  }
};

module.exports = {
  createPayment,
  confirmPayment,
  getPaymentHistory,
  getPaymentById,
  getPaymentStatus,
};