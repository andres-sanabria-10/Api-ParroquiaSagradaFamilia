const express = require('express');
const router = express.Router();


const {
  createUser,
  getAllUsers,
  getUserProfile,
  updateUserById,
  deleteUserById
} = require('../controllers/controll-users');

// Ruta para crear un nuevo usuario
router.post('/', createUser);

// Ruta para obtener todos los usuarios
router.get('/', getAllUsers);

// Ruta para obtener usuario por ID
router.get('/data', getUserProfile);

// Ruta para actualizar un usuario por ID
router.put('/:id', updateUserById);

// Ruta para eliminar un usuario por ID
router.delete('/:id', deleteUserById);

module.exports = router;
