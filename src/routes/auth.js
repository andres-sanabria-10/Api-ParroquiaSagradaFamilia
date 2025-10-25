const express = require('express')
const router = express.Router()

const { loginUser, logoutUser, verifyEmail, verifyCode, registerUser, forgotPassword, verifyResetCode, changePassword } = require('../controllers/controll-auth')

//Login !
router.post('/login', loginUser)
router.post('/logout', logoutUser)

router.post('/forgot-password', forgotPassword);
router.post('/verify-ResetCode', verifyResetCode);
router.post('/change-Password', changePassword);

//Registrar un usuario
router.post('/register', registerUser )

router.post('/verify-Email', verifyEmail);
router.post('/verify-Code', verifyCode);


module.exports = router