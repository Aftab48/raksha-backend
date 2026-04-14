const {StatusCodes} = require('http-status-codes');
const customAPIError = require('./customAPIError');

class UnAuthenticatedError extends customAPIError {
    constructor(msg) {
        super(msg);
        this.statusCode = StatusCodes.UNAUTHORIZED;
    }
};

module.exports = UnAuthenticatedError;