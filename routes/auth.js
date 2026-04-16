const {
    login,
    registerInit,
    verifyEmailOtp,
    completeRegistration,
    verifyMobileOtp
} = require('../controllers/auth.js');
const express = require('express');

const router = express.Router();

router.post('/auth/register/init', registerInit);
router.post('/auth/register/verify-email', verifyEmailOtp);
router.post('/auth/register/verify-mobile', verifyMobileOtp);
router.post('/auth/register/complete', completeRegistration);
router.post('/auth/login', login);

module.exports = router;
