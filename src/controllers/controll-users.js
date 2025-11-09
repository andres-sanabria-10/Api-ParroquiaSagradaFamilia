const User = require('../models/user');
const { verifyToken } = require('../helpers/gerate-token');


module.exports = {

  // Controlador para crear un nuevo usuario
  createUser: async (req, res) => {
    try {
      const { name, lastName, birthdate, documentNumber, typeDocument, mail, password, role } = req.body;

      // Verificar si el correo electrónico ya está registrado
      const existingUser = await User.findOne({ mail });
      if (existingUser) {
        return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
      }

      // Verificar si el numero de documento ya está registrado
      const existingNumDoc = await User.findOne({ documentNumber });
      if (existingNumDoc) {
        return res.status(400).json({ error: 'El número de documento ya está registrado' });
      }



      // Verificar si la fecha de nacimiento es mayor a la fecha actual
      const currentDate = new Date();
      if (new Date(birthdate) > currentDate) {
        return res.status(400).json({ error: 'La fecha de nacimiento no puede ser mayor a la fecha actual' });
      }

      // Establecer el valor predeterminado del rol si no se proporciona
      const defaultRole = 'Usuario';
      const userRole = role || defaultRole;

      const user = new User({
        name,
        lastName,
        birthdate,
        documentNumber,
        typeDocument,
        mail,
        password,  // Guardamos la contraseña hasheada
        role: userRole
      });

      const result = await user.save();

      return res.status(201).json({ data: result });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Controlador para obtener todos los usuarios
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find().populate('typeDocument');
      console.log('Usuarios obtenidos:', users); // Log para depuración
      res.status(200).send(users);
    } catch (err) {
      console.error('Error al obtener usuarios:', err); // Log para depuración
      res.status(500).send({ error: 'Error al obtener usuarios', details: err.message });
    }
  },

// Controlador para obtener el usuario autenticado
// Controlador para obtener el usuario autenticado
getUserProfile: async (req, res) => {
  try {
    let token;

    // ✅ OPCIÓN 1: Intentar obtener el token desde el header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Quitar "Bearer " del inicio
    } 
    // ✅ OPCIÓN 2 (fallback): Si no está en el header, intentar desde cookies
    else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({ error: 'No se proporcionó token de autorización' });
    }

    const tokenData = await verifyToken(token);
    const user = await User.findById(tokenData._id).populate('typeDocument');

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    console.log('Usuario encontrado:', user); // Log para depuración
    res.status(200).json(user);
  } catch (err) {
    console.error('Error al obtener perfil de usuario:', err); // Log para depuración
    res.status(500).json({ error: 'Error al obtener perfil de usuario', details: err.message });
  }
},


  // Controlador para actualizar un usuario por ID
  updateUserById: async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!user) {
        return res.status(404).send();
      }
      res.status(200).send(user);
    } catch (err) {
      res.status(400).send(err);
    }
  },

  // Controlador para eliminar un usuario por ID
  deleteUserById: async (req, res) => {
    try {
      const user = await User.findByIdAndDelete(req.params.id);
      if (!user) {
        return res.status(404).send();
      }
      res.status(200).send(user);
    } catch (err) {
      res.status(500).send(err);
    }
  },


  getUserByDocumentNumber: async (req, res) => {
      try {
        // 1. Buscamos al usuario y poblamos el campo 'typeDocument'
        const user = await User.findOne({ documentNumber: req.params.documentNumber })
                                .populate('typeDocument') // ✨ ESTE ES EL CAMBIO
                                .select('name lastName documentNumber mail role birthdate typeDocument'); 
    
        if (!user) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        res.status(200).json(user);
    
      } catch (error) {
        console.error('Error al buscar usuario por DNI:', error);
        res.status(500).json({ message: 'Error interno del servidor', details: error.message });
      }
    },

};
