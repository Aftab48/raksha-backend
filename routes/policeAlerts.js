const {
    getPoliceAlerts,
    savePoliceAlert,
    getParticularUserPoliceAlerts
} = require('../controllers/policeAlerts');
const express = require('express');
const router = express.Router();

router.route('/police-alerts').post(savePoliceAlert).get(getPoliceAlerts);
router.post('/police-alerts/particularAlert', getParticularUserPoliceAlerts);