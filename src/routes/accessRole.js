const express = require('express');
const router = express.Router();
const checkAuth = require('../middleware/auth')
const checkRoleAuth = require('../middleware/roleAuth')

const {
  accessSuperAdmin,
  accessAdmin,
  accessUser
} = require('../controllers/controll-accessRole');

// Ruta para acceder SuperAdmin
router.get('/super-admin', checkAuth, checkRoleAuth(["SuperAdmin"]), accessSuperAdmin);

// Ruta para acceder Admin
router.get('/admin', checkAuth, checkRoleAuth(["Admin"]), accessAdmin);

// Ruta para acceder User
router.get('/user', checkAuth, checkRoleAuth(["Usuario"]), accessUser);

module.exports = router;
