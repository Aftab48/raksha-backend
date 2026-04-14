const {
    login,
    registerInit,
    verifyEmailOtp,
    completeRegistration
} = require('../controlllers/auth.js');
const express = require('express');

const router = express.Router();

router.post('/auth/register/init', registerInit);
router.post('/auth/register/verify-email', verifyEmailOtp);
router.post('/auth/register/complete', completeRegistration);
router.post('/auth/login', login);

module.exports = router;
