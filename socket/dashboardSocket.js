const { Server } = require('socket.io');

let ioInstance = null;

const getAllowedOrigins = () => (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const initDashboardSocket = (httpServer) => {
    if (ioInstance) {
        return ioInstance;
    }

    ioInstance = new Server(httpServer, {
        cors: {
            origin: getAllowedOrigins(),
            credentials: true
        }
    });

    ioInstance.on('connection', (socket) => {
        socket.on('operator:join', (payload = {}) => {
            socket.data.operatorId = payload.operator_id || payload.operatorId || null;
            socket.data.operatorName = payload.operator_name || payload.operatorName || 'Operator';
            socket.emit('dashboard:connected', {
                connected_at: new Date().toISOString()
            });
        });

        socket.on('operator:acknowledge', (payload = {}) => {
            ioInstance.emit('operator:acknowledge', {
                sos_id: payload.sos_id || payload.sosId || null,
                operator_id: payload.operator_id || payload.operatorId || null,
                acknowledged_at: new Date().toISOString()
            });
        });
    });

    return ioInstance;
};

const emitDashboardEvent = (eventName, payload) => {
    if (!ioInstance) {
        return;
    }

    ioInstance.emit(eventName, payload);
};

module.exports = {
    initDashboardSocket,
    emitDashboardEvent
};
