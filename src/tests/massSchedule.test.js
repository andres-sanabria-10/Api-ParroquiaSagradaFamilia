const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const MassSchedule = require('../models/massSchedule');
const routes = require('../routes/massSchedule');

const app = express();
app.use(express.json());
app.use('/mass-schedule', routes);

// Conectar a una base de datos de prueba
beforeAll(async () => {
  await mongoose.connect('mongodb+srv://jhonatancamilo99:12345@proyecto.j13wixj.mongodb.net/API-TEST?retryWrites=true&w=majority&appName=Proyecto');
});

// Limpiar la base de datos después de cada prueba
afterEach(async () => {
  await MassSchedule.deleteMany();
});

// Cerrar la conexión después de todas las pruebas
afterAll(async () => {
  await mongoose.connection.close();
});

describe('Mass Schedule API', () => {
  describe('POST /', () => {
    it('should create a new mass schedule', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const response = await request(app)
          .post('/mass-schedule')
          .send({
            date: tomorrow.toISOString().split('T')[0],
            timeSlots: [{ time: '10:00', available: true }]
          });
      
        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('date');
        expect(response.body).toHaveProperty('timeSlots');
      });

    it('should not create a mass schedule for past dates', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .post('/mass-schedule')
        .send({
          date: pastDate.toISOString().split('T')[0],
          timeSlots: [{ time: '10:00', available: true }]
        });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBe('No se pueden crear misas para fechas pasadas');
    });
  });

  describe('GET /time-slots', () => {
    it('should get available time slots for a given date', async () => {
      // Primero, crear un horario
      const date = new Date().toISOString().split('T')[0];
      await MassSchedule.create({
        date,
        timeSlots: [
          { time: '10:00', available: true },
          { time: '11:00', available: false }
        ]
      });

      const response = await request(app)
        .get('/mass-schedule/time-slots')
        .query({ date });

      expect(response.statusCode).toBe(200);
      expect(response.body.timeSlots).toHaveLength(1);
      expect(response.body.timeSlots[0].time).toBe('10:00');
    });

    it('should return 404 if no schedule found for the date', async () => {
      const response = await request(app)
        .get('/mass-schedule/time-slots')
        .query({ date: '2099-01-01' });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('No se encontraron horarios para esta fecha');
    });
  });

  describe('POST /remove-time-slots', () => {
    it('should remove specified time slots', async () => {
      const date = new Date().toISOString().split('T')[0];
      await MassSchedule.create({
        date,
        timeSlots: [
          { time: '10:00', available: true },
          { time: '11:00', available: true }
        ]
      });

      const response = await request(app)
        .post('/mass-schedule/remove-time-slots')
        .send({
          date,
          timeSlots: ['10:00']
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.schedule.timeSlots).toHaveLength(1);
      expect(response.body.schedule.timeSlots[0].time).toBe('11:00');
    });

    it('should return 404 if no schedule found for the date', async () => {
      const response = await request(app)
        .post('/mass-schedule/remove-time-slots')
        .send({
          date: '2099-01-01',
          timeSlots: ['10:00']
        });

      expect(response.statusCode).toBe(404);
      expect(response.body.message).toBe('Schedule not found');
    });
  });
});