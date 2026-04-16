require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

//middlewares and utils
const connectDb = require('./db/connectDb');
const notFound = require('./Middlewares/notFound');
const errorHandlerMiddleware = require('./Middlewares/errorHandlerMiddleware');
const authRouter = require('./routes/auth');
const userRouter = require('./routes/user');
const evidenceRouter = require('./routes/evidence');
const dashboardRouter = require('./routes/dashboard');
const { initDashboardSocket } = require('./socket/dashboardSocket');
const policeAlertsRouter = require('./routes/policeAlerts');

const app = express();

const port = process.env.PORT || 3000;
const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(express.json());
app.use(cors({
    origin: corsOrigins.length === 0 ? true : corsOrigins,
    credentials: true
}));

//routes
app.get('/', (req, res) => {
    res.send('Welcome to SafeSphere API');
});

app.use('/api/v1', authRouter);
app.use('/api/v1', userRouter);
app.use('/api/v1', evidenceRouter);
app.use('/api/v1', dashboardRouter);
app.use('/api/v1', policeAlertsRouter);

//error handling middlewares
app.use(notFound);
app.use(errorHandlerMiddleware);

const start = async () => {
    try {
        await connectDb(process.env.MONGO_URI);
        const server = http.createServer(app);
        initDashboardSocket(server);
        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Error starting the server: ', error);
    }
};

start();
