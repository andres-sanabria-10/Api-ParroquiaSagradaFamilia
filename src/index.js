require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Connect to database
require('./config/connect-db')

app.set('PORT', process.env.PORT || 3000);

// ✅ ACTUALIZADO: CORS configurado para cookies
app.use(cors({
  origin: [
    'https://localhost:3000',  // Tu frontend en desarrollo
    'https://localhost:3001',  // Por si usas otro puerto
    'https://tu-dominio-frontend.com' // Tu dominio en producción
  ],
  credentials: true, // 👈 IMPORTANTE: Permite enviar y recibir cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization','Cookie']
}));

// Middlewares
app.use(morgan('dev'))
app.use(express.json())
app.use(cookieParser()); // Usar cookie-parser

// Routes
app.use(require('./routes'))

app.listen(app.get('PORT'), () => console.log(`Server Ready al port ${app.get('PORT')}`))