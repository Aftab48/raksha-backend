const {UnAuthenticatedError} = require('../ErrorHandlers');
const jwt = require('jsonwebtoken');

const authenticateUser = async(req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new UnAuthenticatedError('Authentication invalid');
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: payload.userId, phoneNumber: payload.phoneNumber };
        next();
    } catch (error) {
        throw new UnAuthenticatedError('Authentication invalid');
    }
}

module.exports = {
    authenticateUser
};