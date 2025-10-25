const { verifyToken } = require('../helpers/gerate-token');

const checkAuth = (req, res, next) => {
    try {
        // 1. Intentar leer el token de la cookie primero
        let token = req.cookies.jwt;
        
        // 2. Si no hay cookie, intentar leer del header Authorization (fallback)
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader) {
                token = authHeader.split(' ').pop();
            }
        }

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const tokenData = verifyToken(token);

        if (tokenData._id) {
            req.user = tokenData; // 👈 Guardar datos del usuario en req
            next();
        } else {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    } catch (err) {
        console.error('Authentication error:', err);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = checkAuth;