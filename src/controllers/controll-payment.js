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

// 🔐 Generar firma de ePayco (CORREGIDA)
const generateEpaycoSignature = (referenceCode, amount) => {
  // ⚠️ IMPORTANTE: El orden de los parámetros debe ser exacto
  const string = `${process.env.EPAYCO_P_CUST_ID_CLIENTE}^${process.env.EPAYCO_P_KEY}^${referenceCode}^${amount}^COP`;
  
  console.log('🔐 String para firma:', string);
  const signature = crypto.createHash('md5').update(string).digest('hex');
  console.log('🔐 Firma generada:', signature);
  
  return signature;
};

// 🔐 Validar firma de ePayco en confirmación
const validateEpaycoSignature = (data) => {
  const {
    x_cust_id_cliente,
    x_ref_payco,
    x_transaction_id,
    x_amount,
    x_currency_code,
    x_signature
  } = data;

  const string = `${x_cust_id_cliente}^${process.env.EPAYCO_P_KEY}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`;
  const signature = crypto.createHash('sha256').update(string).digest('hex');

  return signature === x_signature;
};

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
    const user = await userModel.findById(userId);
    
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

    // 🔐 Generar firma para ePayco
    const signature = generateEpaycoSignature(referenceCode, amount);

    // 📋 Construir datos para el checkout de ePayco (CORREGIDO)
    const checkoutData = {
      // 🔹 CREDENCIALES (OBLIGATORIAS)
      p_cust_id_cliente: process.env.EPAYCO_P_CUST_ID_CLIENTE,
      p_key: process.env.EPAYCO_P_KEY,
      
      // 🔹 INFORMACIÓN DEL PAGO (OBLIGATORIAS)
      p_amount: amount.toString(),
      p_amount_base: amount.toString(), // Valor base sin IVA
      p_tax: "0",
      p_tax_base: "0",
      p_currency_code: "COP",
      p_signature: signature,
      p_reference: referenceCode,
      p_description: newPayment.description,
      
      // 🔹 INFORMACIÓN DEL CLIENTE (OBLIGATORIAS)
      p_email: user.mail,
      p_name_billing: user.name,
      p_address_billing: "Calle 123", // Puedes poner una dirección genérica
      p_mobilephone_billing: user.phone || "3001234567",
      
      // 🔹 TIPO Y NÚMERO DE DOCUMENTO
      p_type_doc_billing: user.typeDocument?.document_type_name === 'Cédula de Ciudadanía' ? 'CC' : 'NIT',
      p_number_doc_billing: user.documentNumber,
      
      // 🔹 URLs DE RESPUESTA (OBLIGATORIAS)
      p_url_response: `${process.env.FRONTEND_URL}/payment/response`,
      p_url_confirmation: `${process.env.BACKEND_URL}/api/payment/confirm`,
      
      // 🔹 MODO DE PRUEBA
      p_test_request: process.env.EPAYCO_P_TESTING === 'true' ? 'TRUE' : 'FALSE',
      
      // 🔹 EXTRAS (OPCIONALES)
      p_extra1: userId.toString(),
      p_extra2: serviceType,
      p_extra3: serviceId.toString(),
      
      // 🔹 MÉTODO DE PAGO (OPCIONAL)
      p_method_payment: "ALL", // ALL = Todos los métodos disponibles
    };

    console.log('✅ Pago creado en BD:', newPayment._id);
    console.log('📋 Datos para checkout de ePayco:', JSON.stringify(checkoutData, null, 2));

    // 🎯 Devolver datos para que el frontend redirija al checkout
    res.status(201).json({
      success: true,
      message: 'Pago creado exitosamente',
      payment: {
        id: newPayment._id,
        referenceCode: newPayment.referenceCode,
        amount: newPayment.amount,
        description: newPayment.description,
        status: newPayment.status,
      },
      checkoutData,
      checkoutUrl: 'https://checkout.epayco.co/checkout.php',
    });

  } catch (error) {
    console.error('💥 Error en createPayment:', error);
    res.status(500).json({ 
      error: 'Error al crear el pago',
      details: error.message 
    });
  }
};

// ... resto del código (confirmPayment, etc.)
/**
 * ✅ Confirmar pago - Webhook de ePayco
 * POST /api/payment/confirm
 * Este endpoint es llamado automáticamente por ePayco
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

    // 🔐 Validar firma de ePayco (CRÍTICO para seguridad)
    if (!validateEpaycoSignature(req.body)) {
      console.error('❌ Firma inválida - Posible fraude');
      return res.status(403).json({ error: 'Firma inválida' });
    }

    // 🔍 Buscar el pago por referencia
    const payment = await Payment.findOne({ referenceCode: x_id_invoice });

    if (!payment) {
      console.error('❌ Pago no encontrado con referencia:', x_id_invoice);
      return res.status(404).json({ error: 'Pago no encontrado' });
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

    // 🎯 Actualizar estado según respuesta de ePayco
    // Códigos de respuesta:
    // 1 = Aprobada
    // 2 = Rechazada
    // 3 = Pendiente
    // 4 = Fallida
    
    if (x_cod_response === '1') {
      payment.status = 'approved';
      payment.confirmedAt = new Date();

      // 🔄 Actualizar el estado del servicio relacionado
      if (payment.serviceType === 'mass') {
        await RequestMass.findByIdAndUpdate(payment.serviceId, {
          status: 'Confirmada',
        });
        console.log('✅ Solicitud de misa confirmada:', payment.serviceId);
      } else if (payment.serviceType === 'certificate') {
        await RequestDeparture.findByIdAndUpdate(payment.serviceId, {
          status: 'Pendiente', // Cambia a pendiente para que la secretaria la procese
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

    // ePayco espera una respuesta 200 OK
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
 * 📋 Obtener historial de pagos del usuario
 * GET /api/payment/history
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
 * GET /api/payment/:id
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
 * GET /api/payment/status/:referenceCode
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