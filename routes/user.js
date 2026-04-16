const {
    saveUserTrustedContact,
    getUserTrustedContacts,
    deleteUserTrustedContact
} = require('../controllers/user');
const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../Middlewares/authenticate');

router.post('/user/save-trusted-contacts', authenticateUser, saveUserTrustedContact);
router.get('/user/get-trusted-contacts', authenticateUser, getUserTrustedContacts);
router.delete('/user/trusted-contact/:contactPhoneNumber', authenticateUser, deleteUserTrustedContact);

module.exports = router;
