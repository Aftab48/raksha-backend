const express = require('express');
const {
    createSosAlert,
    getAlerts,
    getAlertById,
    acknowledgeAlert,
    resolveAlert,
    addAlertLocationUpdate,
    saveAlertNotes,
    sendUserNote,
    getUserNotes,
    getStats,
    getHealth
} = require('../controllers/dashboard');
const {
    authenticateDashboardOperator,
    authenticateSosIngress
} = require('../Middlewares/dashboardAuth');
const { authenticateUser } = require('../Middlewares/authenticate');

const router = express.Router();

router.get('/dashboard/health', getHealth);
router.post('/dashboard/sos', authenticateSosIngress, createSosAlert);
router.get('/dashboard/alerts', authenticateDashboardOperator, getAlerts);
router.get('/dashboard/alerts/:id', authenticateDashboardOperator, getAlertById);
router.patch('/dashboard/alerts/:id/acknowledge', authenticateDashboardOperator, acknowledgeAlert);
router.patch('/dashboard/alerts/:id/resolve', authenticateDashboardOperator, resolveAlert);
router.patch('/dashboard/alerts/:id/notes', authenticateDashboardOperator, saveAlertNotes);
router.post('/dashboard/alerts/:id/user-note', authenticateDashboardOperator, sendUserNote);
router.get('/dashboard/alerts/:id/user-notes', authenticateUser, getUserNotes);
router.post('/dashboard/alerts/:id/location', authenticateSosIngress, addAlertLocationUpdate);
router.get('/dashboard/stats', authenticateDashboardOperator, getStats);

module.exports = router;
