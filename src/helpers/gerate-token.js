const jwt = require('jsonwebtoken');

const tokenSign = (user) => {
    try {
        return jwt.sign(
            {
                _id: user._id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h",
            }
        );
    } catch (error) {
        console.error('Error signing token:', error);
        throw new Error('Failed to generate token');
    }
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        console.error('Error verifying token:', error);
        return null;
    }
};

const decodeSign = (token) => {
    try {
        return jwt.decode(token, null);
    } catch (error) {
        console.error('Error decoding token:', error);
        return null;
    }
};

module.exports = { tokenSign, decodeSign, verifyToken };