const Payment = require('../models/payment');
const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const userModel = require('../models/user');
const crypto = require('crypto');
const axios = require('axios'); // ⬅️ Instalar: npm install axios

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
 * 💳 Crear pago y procesar con API de ePayco
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

    // 🌐 Procesar pago con la API de ePayco
    const epaycoData = {
      // Credenciales
      public_key: process.env.EPAYCO_P_PUBLIC_KEY,
      
      // Información de la transacción
      invoice: referenceCode,
      description: newPayment.description,
      value: amount.toString(),
      tax: "0",
      tax_base: "0",
      currency: "cop",
      
      // URLs de respuesta
      url_response: `${process.env.FRONTEND_URL}/payment/response`,
      url_confirmation: `${process.env.BACKEND_URL}/api/payment/confirm`,
      
      // Información del cliente
      name_billing: `${user.name} ${user.lastName}`,
      address_billing: "Carrera 1 # 1-1",
      type_doc_billing: mappedDocType,
      mobilephone_billing: user.phone || "3001234567",
      number_doc_billing: user.documentNumber,
      
      // Email
      email_billing: user.mail,
      
      // Modo de prueba
      test: process.env.EPAYCO_P_TESTING === 'true',
      
      // Extras
      extra1: userId.toString(),
      extra2: serviceType,
      extra3: serviceId.toString(),
      
      // Método de pago (opcional, si no se especifica muestra todos)
      // method_confirmation: "GET", // o "POST"
    };

    console.log('📤 Enviando a ePayco:', JSON.stringify(epaycoData, null, 2));

    // 🚀 Hacer POST a la API de ePayco
    const epaycoResponse = await axios.post(
      'https://secure.epayco.co/validation/v1/reference/create',
      epaycoData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Respuesta de ePayco:', epaycoResponse.data);

    // ✅ ePayco devuelve una URL de pago
    if (epaycoResponse.data.success && epaycoResponse.data.data) {
      // La URL de pago se construye con el ref_payco que devuelve ePayco
      const ref_payco = epaycoResponse.data.data.ref_payco;
      const paymentUrl = `https://checkout.epayco.co/checkout?ref_payco=${ref_payco}`;
      
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
    } else {
      throw new Error('ePayco no devolvió una URL de pago válida');
    }

  } catch (error) {
    console.error('💥 Error en createPayment:', error);
    
    // Manejo detallado de errores
    let errorMessage = 'Error desconocido';
    let errorDetails = {};

    if (error.response) {
      // Error de respuesta de ePayco
      console.error('📡 Error de ePayco:', error.response.data);
      errorMessage = 'Error al procesar el pago con ePayco';
      errorDetails = {
        status: error.response.status,
        data: error.response.data,
        message: error.response.data?.message || error.response.statusText
      };
    } else if (error.request) {
      // Error de red (no hubo respuesta)
      console.error('🌐 Error de red:', error.message);
      errorMessage = 'Error de conexión con ePayco';
      errorDetails = {
        message: error.message,
        code: error.code
      };
    } else {
      // Error en la configuración de la petición
      console.error('⚙️ Error de configuración:', error.message);
      errorMessage = error.message;
      errorDetails = {
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      };
    }

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

    // 🔐 Validar firma (OPCIONAL pero recomendado)
    // const expectedSignature = crypto
    //   .createHash('sha256')
    //   .update(`${x_cust_id_cliente}^${process.env.EPAYCO_P_KEY}^${x_ref_payco}^${x_transaction_id}^${x_amount}^${x_currency_code}`)
    //   .digest('hex');
    
    // if (expectedSignature !== x_signature) {
    //   console.error('❌ Firma inválida');
    //   return res.status(403).json({ error: 'Firma inválida' });
    // }

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