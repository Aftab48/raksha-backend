require('dotenv').config();
const express = require('express');


//middlewares and utils
const connectDb = require('./db/connectDb');
const notFound = require('./Middlewares/notFound');
const errorHandlerMiddleware = require('./Middlewares/errorHandlerMiddleware');
const authRouter = require('./routes/auth');


const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());

//routes
app.get('/', (req, res) => {
    res.send('Welcome to SafeSphere API');
})

app.use('/api/v1', authRouter);

//error handling middlewares
app.use(notFound);
app.use(errorHandlerMiddleware);

const start = async() => {
    try {
        await connectDb(process.env.MONGO_URI);
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Error starting the server: ', error);
    }
}

start();
