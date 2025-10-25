require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();

// Connect to database
require('./config/connect-db')

app.set('PORT', process.env.PORT || 3000);

// ✅ CORS con función para desarrollo y producción
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sin origin (como Postman, apps móviles, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      // Agrega aquí tu dominio de producción cuando lo despliegues
      // 'https://tu-frontend-produccion.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // 👈 Durante desarrollo, permite todos los orígenes
      // callback(new Error('Not allowed by CORS')); // 👈 Usa esto en producción
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie']
}));

// Middlewares
app.use(morgan('dev'))
app.use(express.json())
app.use(cookieParser());

// Routes
app.use(require('./routes'))

app.listen(app.get('PORT'), () => console.log(`Server Ready al port ${app.get('PORT')}`))