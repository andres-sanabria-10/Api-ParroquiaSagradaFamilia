const { verifyToken } = require('../helpers/gerate-token')
const userModel = require('../models/user')

const checkRoleAuth = (roles) => async (req, res, next) => {
    try {
        // El token ya debe haber sido verificado por checkAuth y los datos de usuario adjuntados a req.user
        if (!req.user || !req.user._id) {
            return res.status(401).send({ error: 'Autenticación requerida' });
        }

        const userData = await userModel.findById(req.user._id); // Usar el ID del token verificado
        if (!userData) {
            return res.status(404).send({ error: 'Usuario no encontrado' });
        }

        if (Array.isArray(roles) ? roles.includes(userData.role) : roles === userData.role) {
            return next();
        } else {
            return res.status(403).send({ error: 'No tienes permisos para esta acción' });
        }

    } catch (err) {
        console.error('Error en checkRoleAuth:', err);
        res.status(500).send({ error: 'Error interno del servidor' });
    }
};

module.exports = checkRoleAuth