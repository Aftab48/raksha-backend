const {
    getPoliceAlerts,
    savePoliceAlert,
    getParticularUserPoliceAlerts
} = require('../controllers/policeAlerts');
const express = require('express');
const { authenticateUser } = require('../Middlewares/authenticate');
const router = express.Router();

router.route('/police-alerts').post(authenticateUser,savePoliceAlert).get(getPoliceAlerts);
router.post('/police-alerts/particularAlert', getParticularUserPoliceAlerts);

module.exports = router;
