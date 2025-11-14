/**
 * Tests para el módulo de pagos (Mercado Pago)
 * Prueba endpoints: POST /api/payment/create, POST /api/payment/confirm
 * Mocked: mercadoPagoService, Payment model, User model, etc.
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');

// Mock setup
jest.mock('../src/services/mercadoPagoService');
jest.mock('../src/models/payment');
jest.mock('../src/models/user');
jest.mock('../src/models/requestMass');
jest.mock('../src/models/requestDeparture');
jest.mock('../src/models/massSchedule');

const mercadoPagoService = require('../src/services/mercadoPagoService');
const Payment = require('../src/models/payment');
const userModel = require('../src/models/user');
const RequestMass = require('../src/models/requestMass');
const RequestDeparture = require('../src/models/requestDeparture');

// Importar controlador
const paymentController = require('../src/controllers/controll-payment');

// Crear app de prueba
const app = express();
app.use(express.json());

// Mock middleware de autenticación
app.use((req, res, next) => {
  req.user = { _id: new mongoose.Types.ObjectId() };
  next();
});

// Routes
app.post('/api/payment/create', paymentController.createPayment);
app.post('/api/payment/confirm', paymentController.confirmPayment);

describe('Payment Module (Mercado Pago)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/payment/create', () => {
    it('✅ Debería crear un pago y retornar init_point (checkout URL) de Mercado Pago', async () => {
      // Arrange
      const userId = new mongoose.Types.ObjectId();
      const mockUser = {
        _id: userId,
        name: 'Juan',
        lastName: 'Pérez',
        mail: 'juan@example.com',
        documentNumber: '123456789',
        typeDocument: {
          document_type_name: 'Cédula de Ciudadanía'
        }
      };

      const mockPaymentDoc = {
        _id: new mongoose.Types.ObjectId(),
        referenceCode: 'PAR123456789ABC',
        description: 'Pago por solicitud de misa',
        amount: 50000,
        status: 'pending',
        save: jest.fn().mockResolvedValue({})
      };

      const mockPreference = {
        id: 'pref_123456',
        init_point: 'https://www.mercadopago.com/checkout/v1/redirect?pref_id=pref_123456',
        sandbox_init_point: 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=pref_123456'
      };

      // Mock populate() para que devuelva mockUser
      userModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      
      Payment.mockImplementation(() => mockPaymentDoc);
      mercadoPagoService.createPreference.mockResolvedValue(mockPreference);

      // Act
      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          serviceId: new mongoose.Types.ObjectId(),
          amount: 50000,
          description: 'Pago por solicitud de misa',
          phone: '3161234567',
          address: 'Calle 1 #1-1'
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Mercado Pago');
      expect(response.body.checkout).toBeDefined();
      expect(response.body.checkout.init_point).toBe(mockPreference.init_point);
      expect(response.body.checkout.preferenceId).toBe(mockPreference.id);
    });

    it('❌ Debería fallar si faltan datos requeridos', async () => {
      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          // faltan serviceId, amount, phone, address
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Faltan datos');
    });

    it('❌ Debería fallar si el monto es menor a $5,000 COP', async () => {
      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          serviceId: new mongoose.Types.ObjectId(),
          amount: 1000, // Menor al mínimo
          description: 'Test',
          phone: '3161234567',
          address: 'Calle 1 #1-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Monto mínimo');
    });

    it('❌ Debería fallar si el usuario no existe', async () => {
      const userId = new mongoose.Types.ObjectId();
      userModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          serviceId: new mongoose.Types.ObjectId(),
          amount: 50000,
          description: 'Test',
          phone: '3161234567',
          address: 'Calle 1 #1-1'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Usuario no encontrado');
    });

    it('❌ Debería fallar si el usuario tiene perfil incompleto', async () => {
      const mockUserIncomplete = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Juan',
        lastName: 'Pérez',
        mail: '', // email vacío
        documentNumber: '123456789'
      };

      userModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUserIncomplete)
      });

      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          serviceId: new mongoose.Types.ObjectId(),
          amount: 50000,
          description: 'Test',
          phone: '3161234567',
          address: 'Calle 1 #1-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Perfil incompleto');
    });

    it('❌ Debería fallar si el teléfono no tiene 10 dígitos', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Juan',
        lastName: 'Pérez',
        mail: 'juan@example.com',
        documentNumber: '123456789',
        typeDocument: { document_type_name: 'CC' }
      };

      userModel.findById.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          serviceId: new mongoose.Types.ObjectId(),
          amount: 50000,
          description: 'Test',
          phone: '123', // Teléfono inválido
          address: 'Calle 1 #1-1'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Teléfono');
    });

    it('❌ Debería manejar error de Mercado Pago al crear preference', async () => {
      const mockUser = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Juan',
        lastName: 'Pérez',
        mail: 'juan@example.com',
        documentNumber: '123456789',
        typeDocument: { document_type_name: 'CC' }
      };

      const mockPaymentDoc = {
        _id: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue({}),
      };

      userModel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockUser)
      });
      Payment.mockImplementation(() => mockPaymentDoc);
      Payment.findByIdAndDelete = jest.fn().mockResolvedValue({});
      
      mercadoPagoService.createPreference.mockRejectedValue(
        new Error('API key inválida')
      );

      const response = await request(app)
        .post('/api/payment/create')
        .send({
          serviceType: 'mass',
          serviceId: new mongoose.Types.ObjectId(),
          amount: 50000,
          description: 'Test',
          phone: '3161234567',
          address: 'Calle 1 #1-1'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Error');
    });
  });

  describe('POST /api/payment/confirm (Webhook de Mercado Pago)', () => {
    it('✅ Debería confirmar pago approved y actualizar RequestMass', async () => {
      // Arrange
      const paymentId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();

      const mockMpPayment = {
        id: 'mp_12345',
        status: 'approved',
        external_reference: 'PAR123456789ABC'
      };

      const mockPaymentDb = {
        _id: paymentId,
        referenceCode: 'PAR123456789ABC',
        serviceType: 'mass',
        serviceId: serviceId,
        status: 'pending',
        transactionId: null,
        gatewayData: {},
        save: jest.fn().mockResolvedValue({})
      };

      const mockRequestMass = {
        _id: serviceId,
        date: new Date(),
        time: '10:00',
        status: 'Pendiente'
      };

      mercadoPagoService.getPaymentById.mockResolvedValue(mockMpPayment);
      Payment.findOne.mockResolvedValue(mockPaymentDb);
      RequestMass.findByIdAndUpdate.mockResolvedValue(mockRequestMass);
      jest.spyOn(mongoose.Types, 'ObjectId').mockReturnValue(serviceId);

      // Act
      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_12345', topic: 'payment' })
        .send({});

      // Assert
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
      expect(mockPaymentDb.status).toBe('approved');
      expect(mockPaymentDb.save).toHaveBeenCalled();
    });

    it('✅ Debería confirmar pago approved y actualizar RequestDeparture', async () => {
      const paymentId = new mongoose.Types.ObjectId();
      const serviceId = new mongoose.Types.ObjectId();

      const mockMpPayment = {
        id: 'mp_12345',
        status: 'approved',
        external_reference: 'PAR123456789ABC'
      };

      const mockPaymentDb = {
        _id: paymentId,
        referenceCode: 'PAR123456789ABC',
        serviceType: 'certificate',
        serviceId: serviceId,
        status: 'pending',
        transactionId: null,
        gatewayData: {},
        save: jest.fn().mockResolvedValue({})
      };

      mercadoPagoService.getPaymentById.mockResolvedValue(mockMpPayment);
      Payment.findOne.mockResolvedValue(mockPaymentDb);
      RequestDeparture.findByIdAndUpdate.mockResolvedValue({});

      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_12345', topic: 'payment' })
        .send({});

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
      expect(mockPaymentDb.status).toBe('approved');
      expect(RequestDeparture.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('✅ Debería manejar pago en procesamiento (in_process)', async () => {
      const paymentId = new mongoose.Types.ObjectId();

      const mockMpPayment = {
        id: 'mp_12345',
        status: 'in_process',
        external_reference: 'PAR123456789ABC'
      };

      const mockPaymentDb = {
        _id: paymentId,
        referenceCode: 'PAR123456789ABC',
        serviceType: 'mass',
        status: 'pending',
        transactionId: null,
        gatewayData: {},
        save: jest.fn().mockResolvedValue({})
      };

      mercadoPagoService.getPaymentById.mockResolvedValue(mockMpPayment);
      Payment.findOne.mockResolvedValue(mockPaymentDb);

      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_12345' })
        .send({});

      expect(response.status).toBe(200);
      expect(mockPaymentDb.status).toBe('pending');
    });

    it('✅ Debería manejar pago rechazado (rejected)', async () => {
      const paymentId = new mongoose.Types.ObjectId();

      const mockMpPayment = {
        id: 'mp_12345',
        status: 'rejected',
        external_reference: 'PAR123456789ABC'
      };

      const mockPaymentDb = {
        _id: paymentId,
        referenceCode: 'PAR123456789ABC',
        status: 'pending',
        transactionId: null,
        gatewayData: {},
        save: jest.fn().mockResolvedValue({})
      };

      mercadoPagoService.getPaymentById.mockResolvedValue(mockMpPayment);
      Payment.findOne.mockResolvedValue(mockPaymentDb);

      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_12345' })
        .send({});

      expect(response.status).toBe(200);
      expect(mockPaymentDb.status).toBe('rejected');
    });

    it('❌ Debería ignorar webhook sin datos válidos de Mercado Pago', async () => {
      const response = await request(app)
        .post('/api/payment/confirm')
        .send({}); // sin id ni topic

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
      // No debe buscar en la BD
      expect(mercadoPagoService.getPaymentById).not.toHaveBeenCalled();
    });

    it('❌ Debería ignorar pago MP no encontrado en API', async () => {
      mercadoPagoService.getPaymentById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_invalid' })
        .send({});

      expect(response.status).toBe(200);
      expect(Payment.findOne).not.toHaveBeenCalled();
    });

    it('❌ Debería ignorar notificación sin pago local correspondiente', async () => {
      const mockMpPayment = {
        id: 'mp_12345',
        status: 'approved',
        external_reference: 'PAR_UNKNOWN'
      };

      mercadoPagoService.getPaymentById.mockResolvedValue(mockMpPayment);
      Payment.findOne.mockResolvedValue(null); // no encontrado

      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_12345' })
        .send({});

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });

    it('✅ Debería manejar errores y responder OK (webhook nunca falla)', async () => {
      mercadoPagoService.getPaymentById.mockRejectedValue(
        new Error('Error de conexión')
      );

      const response = await request(app)
        .post('/api/payment/confirm')
        .query({ id: 'mp_12345' })
        .send({});

      // Webhook siempre responde OK, aunque falle internamente
      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
    });
  });

  describe('Helper functions', () => {
    it('✅ generateReference debería crear una referencia única con formato PAR...', () => {
      const { generateReference } = paymentController;
      const ref1 = generateReference();
      const ref2 = generateReference();

      expect(ref1).toMatch(/^PAR\d+[A-Z0-9]+$/);
      expect(ref2).toMatch(/^PAR\d+[A-Z0-9]+$/);
      expect(ref1).not.toBe(ref2); // diferentes
    });
  });
});
