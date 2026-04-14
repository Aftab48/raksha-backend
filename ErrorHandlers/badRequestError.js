const {StatusCodes} = require('http-status-codes');
const customAPIError = require('./customAPIError');

class BadRequestError extends customAPIError {
    constructor(msg) {
        super(msg);
        this.statusCode = StatusCodes.BAD_REQUEST;
    }
};

module.exports = BadRequestError;