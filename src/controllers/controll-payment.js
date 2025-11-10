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

// 🔐 Mapear tipo de documento
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
 * 💳 Crear pago y procesar con Checkout de ePayco
 */
const createPayment = async (req, res) => {
  try {
    const userId = req.user._id;
    const { serviceType, serviceId, amount, description } = req.body;

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

    // 🔑 Generar referencia única
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

    // 🔐 Mapear tipo de documento
    const mappedDocType = mapDocumentType(user.typeDocument?.document_type_name);

    console.log('👤 Datos del usuario:', {
      name: `${user.name} ${user.lastName}`,
      email: user.mail,
      documentType: user.typeDocument?.document_type_name,
      mappedDocType,
      documentNumber: user.documentNumber,
      phone: user.phone
    });

    // 🔐 Generar firma de seguridad
    const p_cust_id_cliente = process.env.EPAYCO_P_CUST_ID;
    const p_key = process.env.EPAYCO_P_KEY;
    
    // Formato: p_cust_id_cliente^p_key^p_id_invoice^p_amount^p_currency_code
    const signatureString = `${p_cust_id_cliente}^${p_key}^${referenceCode}^${amount}^COP`;
    const signature = crypto.createHash('sha256').update(signatureString).digest('hex');

    console.log('🔐 Firma generada:', {
      signatureString: signatureString.replace(p_key, '***'),
      signature
    });

    // 🌐 Construir URL de checkout correcta
    const checkoutUrl = new URL('https://checkout.epayco.co/');

    // ⚠️ PARÁMETROS CORRECTOS SEGÚN DOCUMENTACIÓN EPAYCO
    // Parámetros básicos
    checkoutUrl.searchParams.append('p_cust_id_cliente', p_cust_id_cliente);
    checkoutUrl.searchParams.append('p_key', p_key);
    checkoutUrl.searchParams.append('p_id_invoice', referenceCode);
    checkoutUrl.searchParams.append('p_description', newPayment.description);
    checkoutUrl.searchParams.append('p_amount', amount.toString());
    checkoutUrl.searchParams.append('p_amount_base', amount.toString());
    checkoutUrl.searchParams.append('p_tax', '0');
    checkoutUrl.searchParams.append('p_currency_code', 'COP');
    checkoutUrl.searchParams.append('p_signature', signature);

    // URLs de respuesta
    checkoutUrl.searchParams.append('p_url_response', `${process.env.FRONTEND_URL}/payment/response`);
    checkoutUrl.searchParams.append('p_confirmation_url', `${process.env.BACKEND_URL}/api/payment/confirm`);

    // Información del cliente
    checkoutUrl.searchParams.append('p_email', user.mail);
    checkoutUrl.searchParams.append('p_name', user.name);
    checkoutUrl.searchParams.append('p_last_name', user.lastName);
    checkoutUrl.searchParams.append('p_phone', user.phone || '3001234567');
    checkoutUrl.searchParams.append('p_mobile', user.phone || '3001234567');
    checkoutUrl.searchParams.append('p_address', 'Carrera 1 # 1-1');
    checkoutUrl.searchParams.append('p_country', 'CO');
    checkoutUrl.searchParams.append('p_city', 'Bogota');
    checkoutUrl.searchParams.append('p_postal_code', '110111');
    
    // Documento de identidad
    checkoutUrl.searchParams.append('p_type_doc', mappedDocType);
    checkoutUrl.searchParams.append('p_document', user.documentNumber);

    // Extras para identificación
    checkoutUrl.searchParams.append('p_extra1', userId.toString());
    checkoutUrl.searchParams.append('p_extra2', serviceType);
    checkoutUrl.searchParams.append('p_extra3', serviceId.toString());

    // Idioma y modo prueba
    checkoutUrl.searchParams.append('p_lang', 'es');
    checkoutUrl.searchParams.append('p_test_request', process.env.EPAYCO_P_TESTING === 'true' ? 'true' : 'false');

    const paymentUrl = checkoutUrl.toString();
    console.log('🌐 URL de checkout generada:', paymentUrl);

    // ✅ Retornar la URL directamente
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
      paymentUrl: paymentUrl,
    });

  } catch (error) {
    console.error('💥 Error en createPayment:', error);

    // Manejo detallado de errores
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
    console.log('🔔 Webhook de ePayco recibido:', req.body);

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
      x_extra1, // userId
      x_extra2, // serviceType
      x_extra3, // serviceId
    } = req.body;

    // 🔍 Buscar el pago por referencia
    const payment = await Payment.findOne({ referenceCode: x_id_invoice });

    if (!payment) {
      console.error('❌ Pago no encontrado con referencia:', x_id_invoice);
      return res.status(404).json({ error: 'Pago no encontrado' });
    }

    // 🔐 Validar firma (RECOMENDADO EN PRODUCCIÓN)
    const expectedSignature = crypto
      .createHash('sha256')
      .update(`${x_cust_id_cliente}^${process.env.EPAYCO_P_KEY}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`)
      .digest('hex');

    if (expectedSignature !== x_signature) {
      console.error('❌ Firma inválida');
      console.log('Esperada:', expectedSignature);
      console.log('Recibida:', x_signature);
      
      // En modo prueba, permitir continuar pero loguear advertencia
      if (process.env.EPAYCO_P_TESTING !== 'true') {
        return res.status(403).json({ error: 'Firma inválida' });
      } else {
        console.warn('⚠️ Firma inválida pero permitiendo en modo prueba');
      }
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
      transactionDate: new Date(x_transaction_date),
    };

    // 🎯 Actualizar estado según respuesta
    if (x_cod_response === '1') {
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

    } else if (x_cod_response === '2') {
      payment.status = 'rejected';
      console.log('❌ Pago rechazado');
    } else if (x_cod_response === '3') {
      payment.status = 'pending';
      console.log('⏳ Pago pendiente');
    } else {
      payment.status = 'failed';
      console.log('💥 Pago fallido');
    }

    await payment.save();

    console.log('✅ Pago actualizado correctamente:', payment._id);

    res.status(200).send('OK');

  } catch (error) {
    console.error('💥 Error en confirmPayment:', error);
    res.status(500).json({
      error: 'Error al confirmar el pago',
      details: error.message
    });
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