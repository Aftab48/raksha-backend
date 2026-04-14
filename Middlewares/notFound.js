const {StatusCodes} = require('http-status-codes');

const notFound = async(req, res) => {
    res.status(StatusCodes.NOT_FOUND).send("<h3>Route Does not Exist</h3>");
}

module.exports = notFound;