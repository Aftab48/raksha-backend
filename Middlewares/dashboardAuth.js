const jwt = require('jsonwebtoken');
const { UnAuthenticatedError } = require('../ErrorHandlers');

const isDevBypassEnabled = () => {
    if (typeof process.env.DASHBOARD_DEV_MODE === 'string') {
        return process.env.DASHBOARD_DEV_MODE === 'true';
    }

    return process.env.NODE_ENV !== 'production';
};

const parseBearerToken = (req) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return null;
    }

    return header.split(' ')[1];
};

const decodeToken = (token) => {
    if (!token) {
        return null;
    }

    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (_error) {
        throw new UnAuthenticatedError('Authentication invalid');
    }
};

const buildOperator = (payload) => ({
    id: payload.userId || payload.id || null,
    name: payload.userName || payload.name || payload.phoneNumber || 'Operator',
    station: payload.station || process.env.DASHBOARD_DEFAULT_STATION || 'Central Station'
});

const authenticateDashboardOperator = (req, res, next) => {
    const token = parseBearerToken(req);

    if (token) {
        const payload = decodeToken(token);
        req.operator = buildOperator(payload);
        return next();
    }

    if (isDevBypassEnabled()) {
        req.operator = {
            id: 'dev-operator',
            name: process.env.DASHBOARD_DEV_OPERATOR || 'Dev Operator',
            station: process.env.DASHBOARD_DEFAULT_STATION || 'Demo Station'
        };
        return next();
    }

    throw new UnAuthenticatedError('Authentication invalid');
};

const authenticateSosIngress = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && process.env.SOS_INGEST_API_KEY && apiKey === process.env.SOS_INGEST_API_KEY) {
        req.ingressAuth = 'api-key';
        return next();
    }

    const token = parseBearerToken(req);
    if (token) {
        const payload = decodeToken(token);
        req.operator = buildOperator(payload);
        req.ingressAuth = 'jwt';
        return next();
    }

    if (isDevBypassEnabled()) {
        req.ingressAuth = 'dev-bypass';
        return next();
    }

    throw new UnAuthenticatedError('Authentication invalid');
};

module.exports = {
    authenticateDashboardOperator,
    authenticateSosIngress
};
