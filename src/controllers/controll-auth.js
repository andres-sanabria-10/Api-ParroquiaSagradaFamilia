const User = require('../models/user');
const TempVerification = require('../models/tempVerification');
const { encrypt, compare } = require('../helpers/handleBcrypt')
const { tokenSign } = require('../helpers/gerate-token')

const emailService = require('../services/emailService');
const passwordService = require('../services/passwordService');


module.exports = {

    verifyEmail: async (req, res) => {
        try {
            const { mail } = req.body;

            // Verificar si el correo electrónico ya está registrado
            const existingUser = await User.findOne({ mail });
            if (existingUser) {
                return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
            }

            // Generar código de verificación
            const verificationCode = passwordService.generateResetCode();

            // Guardar el código temporalmente
            await TempVerification.findOneAndUpdate(
                { mail },
                { verificationCode, expiresAt: Date.now() + 3600000 }, // 1 hora de expiración
                { upsert: true, new: true }
            );

            // Enviar código por correo
            await emailService.sendVerifyCode(mail, verificationCode);

            res.status(200).json({ message: 'Código de verificación enviado' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },




    verifyCode: async (req, res) => {
        try {
            const { mail, verificationCode } = req.body;

            const verification = await TempVerification.findOne({
                mail,
                verificationCode,
                expiresAt: { $gt: Date.now() }
            });

            if (!verification) {
                return res.status(400).json({ error: 'Código inválido o expirado' });
            }

            // Si el código es válido, marcamos la verificación como completada
            verification.isVerified = true;
            await verification.save();

            res.status(200).json({ message: 'Código verificado correctamente' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    registerUser: async (req, res) => {
        try {
            const { name, lastName, birthdate, documentNumber, typeDocument, mail, password, role } = req.body;

            // Verificar si el correo ha sido verificado
            const verification = await TempVerification.findOne({ mail, isVerified: true });
            if (!verification) {
                return res.status(400).json({ error: 'El correo electrónico no ha sido verificado' });
            }

            // Validar la fecha de nacimiento
            const birthDate = new Date(birthdate);
            const currentDate = new Date();
            const minBirthDate = new Date('1930-01-01');

            if (birthDate > currentDate || birthDate < minBirthDate) {
                return res.status(400).json({ error: 'La fecha de nacimiento debe estar entre 1930 y la fecha actual' });
            }

            // Verificar que la contraseña tenga al menos 8 caracteres
            if (password.length < 8) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
            }

            // Establecer el valor predeterminado del rol si no se proporciona
            const defaultRole = 'Usuario';
            const userRole = role || defaultRole;

            // Encriptación contraseña
            const passwordHash = await encrypt(password)

            const user = new User({
                name,
                lastName,
                birthdate,
                documentNumber,
                typeDocument,
                mail,
                password: passwordHash,
                role: userRole
            });

            const result = await user.save();

            // Eliminar la verificación temporal
            await TempVerification.deleteOne({ mail });

            return res.status(201).json({ data: result });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    },

    // Solo la función loginUser actualizada - reemplaza la que tienes

    loginUser: async (req, res) => {
        try {
            const { mail, password } = req.body;

            console.log("🔍 Login attempt for:", mail);

            if (!mail || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const user = await User.findOne({ mail });

            if (!user) {
                console.log("❌ User not found:", mail);
                return res.status(404).json({ error: 'User not found' });
            }

            const checkPassword = await compare(password, user.password);

            if (!checkPassword) {
                console.log("❌ Invalid password for:", mail);
                return res.status(401).json({ error: 'Invalid password' });
            }

            // JWT 
            const tokenSession = await tokenSign(user);
            console.log("🔑 Token generated successfully");

            // ✅ Cookie configurada para cross-origin
            // IMPORTANTE: Render usa HTTPS, así que secure DEBE ser true
            res.cookie('jwt', tokenSession, {
                httpOnly: true,      // No accesible desde JavaScript del cliente
                secure: true,        // HTTPS obligatorio (Render usa HTTPS)
                sameSite: 'none',    // Permite cookies entre dominios diferentes
                maxAge: 3600000,     // 1 hora en milisegundos
                path: '/'            // Disponible en todas las rutas
            });

            console.log("🍪 Cookie JWT set successfully");

            const userResponse = user.toObject();
            delete userResponse.password;

            // ✅ Asegurarse de que el rol esté en minúsculas
            userResponse.role = user.role.toLowerCase();

            console.log("✅ Login successful for:", mail, "- Role:", userResponse.role);

            // ✅ Respuesta JSON correcta
            return res.status(200).json({
                message: 'Login successful',
                data: userResponse,
            });

        } catch (err) {
            console.error('❌ Login error:', err);
            return res.status(500).json({
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        }
    },
    logoutUser: async (req, res) => {
        try {
            res.clearCookie('jwt', {
                httpOnly: true,
                secure: true, // 👈 Debe coincidir con la configuración del login
                sameSite: 'none', // 👈 Debe coincidir con la configuración del login
                path: '/'
            });

            return res.status(200).json({
                message: 'Logout successful',
                success: true
            });
        } catch (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    },

    forgotPassword: async (req, res) => {
        try {
            const { mail } = req.body;
            const user = await User.findOne({ mail });
            if (!user) {
                return res.status(404).json({ message: 'Usuario no encontrado' });
            }

            const resetCode = passwordService.generateResetCode();
            user.resetCode = resetCode;
            user.resetCodeExpires = Date.now() + 3600000; // 1 hora
            await user.save();

            try {
                await emailService.sendResetCode(mail, resetCode);
                res.status(200).json({ message: 'Código de recuperación enviado' });
            } catch (emailError) {
                console.error('Error al enviar el correo:', emailError);
                res.status(500).json({ message: 'Error al enviar el correo de recuperación' });
            }
        } catch (error) {
            console.error('Error en forgotPassword:', error);
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    // Función para verificar el código de reinicio
    verifyResetCode: async (req, res) => {
        try {
            const { mail, resetCode } = req.body;
            const user = await User.findOne({
                mail,
                resetCode,
                resetCodeExpires: { $gt: Date.now() }
            });

            if (!user) {
                return res.status(400).json({ message: 'Código inválido o expirado' });
            }

            res.status(200).json({ message: 'Código válido', userId: user._id });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    },

    // Función para cambiar la contraseña
    changePassword: async (req, res) => {
        try {
            const { mail, resetCode, newPassword } = req.body; // 👈 Agregar resetCode

            // 👇 Validar que el código sea válido
            const user = await User.findOne({
                mail,
                resetCode,
                resetCodeExpires: { $gt: Date.now() }
            });

            if (!user) {
                return res.status(400).json({ message: 'Código inválido o expirado' });
            }

            // Validar longitud de contraseña
            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
            }

            // Encriptación de la nueva contraseña
            const passwordHash = await encrypt(newPassword);

            user.password = passwordHash;
            user.resetCode = undefined;
            user.resetCodeExpires = undefined;
            await user.save();

            res.status(200).json({ message: 'Contraseña actualizada exitosamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error en el servidor', error: error.message });
        }
    }
}