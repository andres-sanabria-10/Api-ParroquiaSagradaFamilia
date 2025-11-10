const User = require('../models/user');
const { verifyToken } = require('../helpers/gerate-token');
const { encrypt } = require('../helpers/handleBcrypt'); // <-- ✨ 1. IMPORTAMOS EL HASHER

module.exports = {

  // --- ✨ FUNCIÓN 'createUser' TOTALMENTE ACTUALIZADA ---
  createUser: async (req, res) => {
    try {
      const { name, lastName, birthdate, documentNumber, typeDocument, mail, password, role } = req.body;

      // 1. Validaciones básicas
      const currentDate = new Date();
      if (new Date(birthdate) > currentDate) {
        return res.status(400).json({ error: 'La fecha de nacimiento no puede ser mayor a la fecha actual' });
      }
      if (!password || password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }

      // 2. Buscamos al usuario por DNI
      let user = await User.findOne({ documentNumber });

      // 3. Hasheamos la contraseña que nos envió el usuario
      const passwordHash = await encrypt(password);

      if (user) {
        // --- ESCENARIO A: EL USUARIO YA EXISTE (Creado por la secretaria) ---
        
        // Verificamos que el email que intenta usar no esté en OTRA cuenta
        const existingEmail = await User.findOne({ mail, _id: { $ne: user._id } });
        if (existingEmail) {
          return res.status(400).json({ error: 'El correo electrónico ya está registrado en otra cuenta' });
        }

        // "Activamos" la cuenta actualizando sus datos
        user.name = name;
        user.lastName = lastName;
        user.mail = mail;
        user.birthdate = birthdate;
        user.typeDocument = typeDocument;
        user.password = passwordHash; // ✨ Actualizamos la contraseña temporal por la real
        user.role = user.role || 'feligres'; // Mantenemos el rol (ej. 'feligres')

        const updatedUser = await user.save();
        return res.status(200).json({ data: updatedUser, message: 'Cuenta activada y actualizada exitosamente' });

      } else {
        // --- ESCENARIO B: EL USUARIO ES NUEVO ---
        
        // Verificamos que el email no exista
        const existingEmail = await User.findOne({ mail });
        if (existingEmail) {
          return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
        }

        // Creamos el nuevo usuario
        const newUser = new User({
          name,
          lastName,
          birthdate,
          documentNumber,
          typeDocument,
          mail,
          password: passwordHash, // ✨ Guardamos la contraseña hasheada
          role: 'feligres' // Forzamos el rol a 'feligres' en el registro público
        });

        const result = await newUser.save();
        return res.status(201).json({ data: result });
      }

    } catch (err) {
      if (err.code === 11000) { 
        return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  },

  // Controlador para obtener todos los usuarios
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find().populate('typeDocument');
      console.log('Usuarios obtenidos:', users); 
      res.status(200).send(users);
    } catch (err) {
      console.error('Error al obtener usuarios:', err); 
      res.status(500).send({ error: 'Error al obtener usuarios', details: err.message });
    }
  },

// Controlador para obtener el usuario autenticado
getUserProfile: async (req, res) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); 
    } 
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

    console.log('Usuario encontrado:', user); 
    res.status(200).json(user);
  } catch (err) {
    console.error('Error al obtener perfil de usuario:', err); 
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
        const user = await User.findOne({ documentNumber: req.params.documentNumber })
                                .populate('typeDocument') 
                                .select('name lastName documentNumber mail role birthdate typeDocument'); 
    
        if (!user) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        
        res.status(200).json(user);
    
      } catch (error) {
        console.error('Error al buscar usuario por DNI:', error);
        res.status(500).json({ message: 'Error interno del servidor', details: error.message });
  S }
    },
};