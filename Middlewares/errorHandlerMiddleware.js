const {StatusCodes} = require('http-status-codes');
const {CustomAPIError} = require('../ErrorHandlers');

const errorHandlerMiddleware = async(err, req, res, next) => {
    if(err instanceof CustomAPIError){
        return res.status(err.statusCode).json({msg: err.message});
    }
    res.status(500).json({msg: err.message || 'Something went wrong, please try again later'});
}

module.exports = errorHandlerMiddleware;