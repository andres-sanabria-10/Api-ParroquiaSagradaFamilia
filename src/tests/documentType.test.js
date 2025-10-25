const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const DocumentType = require('../models/DocumentType');
const documentTypeRoutes = require('../routes/documentType');

const app = express();
app.use(express.json());
app.use('/documentTypes', documentTypeRoutes);

const MONGODB_URI_TEST = 'mongodb+srv://jhonatancamilo99:12345@proyecto.j13wixj.mongodb.net/API-TEST?retryWrites=true&w=majority&appName=Proyecto';

beforeAll(async () => {
  await mongoose.connect(MONGODB_URI_TEST);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await DocumentType.deleteMany({});
});

describe('DocumentType API', () => {
  it('should create a new document type', async () => {
    const res = await request(app)
      .post('/documentTypes')
      .send({
        document_type_name: 'Pasaporte'
      });
    
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.document_type_name).toBe('Pasaporte');
  });

  it('should get all document types', async () => {
    await DocumentType.insertMany([
      { document_type_name: 'DNI' },
      { document_type_name: 'Pasaporte' }
    ]);

    const res = await request(app).get('/documentTypes');
    
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0]).toHaveProperty('document_type_name');
  });

  it('should handle errors when creating an invalid document type', async () => {
    const res = await request(app)
      .post('/documentTypes')
      .send({
        // Enviamos un objeto vacío para probar el manejo de errores
      });
    
    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('err');
  });

  it('should handle errors when getting document types fails', async () => {
    // Simulamos un error en la base de datos
    jest.spyOn(DocumentType, 'find').mockImplementationOnce(() => {
      throw new Error('Database error');
    });

    const res = await request(app).get('/documentTypes');
    
    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty('err');
  });
});