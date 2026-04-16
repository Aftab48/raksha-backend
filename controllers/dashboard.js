const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const { BadRequestError } = require('../ErrorHandlers');
const SosAlert = require('../models/sosAlert');
const LocationUpdate = require('../models/locationUpdate');
const { emitDashboardEvent } = require('../socket/dashboardSocket');
const {
    serializeAlert,
    serializeAlertDetail
} = require('../utils/dashboardSerializers');

const DEFAULT_OPERATOR = 'Operator';
const STATUS_ORDER = { active: 0, acknowledged: 1, resolved: 2 };

const asFiniteNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }

    return parsed;
};

const parseIsoDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
};

const normalizeTriggerType = (value) => {
    const normalized = String(value || 'manual').toLowerCase();
    return normalized === 'auto' ? 'auto' : 'manual';
};

const normalizeIncidentType = (value) => {
    const normalized = String(value || 'sos').toLowerCase();
    return normalized === 'panic' ? 'panic' : 'sos';
};

const normalizeIncidentTypeFilter = (value) => {
    const normalized = String(value || 'all').toLowerCase();
    if (normalized === 'panic') {
        return { incidentType: 'panic' };
    }
    if (normalized === 'sos') {
        return { incidentType: 'sos' };
    }
    return {};
};

const normalizeStatusFilter = (value) => {
    const normalized = String(value || 'all').toLowerCase();
    if (normalized === 'active') {
        return { status: { $in: ['active', 'acknowledged'] } };
    }

    if (normalized === 'acknowledged') {
        return { status: 'acknowledged' };
    }

    if (normalized === 'resolved') {
        return { status: 'resolved' };
    }

    return {};
};

const ensureObjectId = (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new BadRequestError('Invalid alert id');
    }
};

const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '');

const phoneMatches = (left, right) => {
    const normalizedLeft = normalizePhone(left);
    const normalizedRight = normalizePhone(right);
    if (!normalizedLeft || !normalizedRight) {
        return false;
    }
    return normalizedLeft === normalizedRight || normalizedLeft.slice(-10) === normalizedRight.slice(-10);
};

const serializeUserNote = (note) => ({
    id: String(note._id),
    message: note.message,
    sent_at: note.sentAt?.toISOString?.() || null,
    sent_by: note.sentBy?.operatorName || null
});

const getDateRangeFilter = (from, to) => {
    const fromDate = parseIsoDate(from);
    const toDate = parseIsoDate(to);
    if (!fromDate && !toDate) {
        return null;
    }

    const filter = {};
    if (fromDate) {
        filter.$gte = fromDate;
    }
    if (toDate) {
        filter.$lte = toDate;
    }
    return filter;
};

const buildStatsPayload = async () => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const activeAlertsPromise = SosAlert.countDocuments({ status: { $in: ['active', 'acknowledged'] } });
    const alertsTodayPromise = SosAlert.countDocuments({ createdAt: { $gte: startOfToday, $lt: startOfTomorrow } });
    const autoTodayPromise = SosAlert.countDocuments({
        createdAt: { $gte: startOfToday, $lt: startOfTomorrow },
        triggerType: 'auto'
    });
    const manualTodayPromise = SosAlert.countDocuments({
        createdAt: { $gte: startOfToday, $lt: startOfTomorrow },
        triggerType: 'manual'
    });
    const falseAlertsTodayPromise = SosAlert.countDocuments({
        resolvedAt: { $gte: startOfToday, $lt: startOfTomorrow },
        falseAlert: true
    });
    const resolvedTodayPromise = SosAlert.find({
        status: 'resolved',
        resolvedAt: { $gte: startOfToday, $lt: startOfTomorrow }
    }).select('createdAt resolvedAt').lean();
    const alertsByHourPromise = SosAlert.aggregate([
        { $match: { createdAt: { $gte: startOfToday, $lt: startOfTomorrow } } },
        { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } }
    ]);

    const sevenDaysAgo = new Date(startOfToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const responseTrendPromise = SosAlert.find({
        status: 'resolved',
        resolvedAt: { $gte: sevenDaysAgo }
    }).select('createdAt resolvedAt').lean();

    const topAreasPromise = SosAlert.find({
        createdAt: { $gte: sevenDaysAgo }
    }).select('initialLat initialLng').lean();

    const [
        activeAlerts,
        totalAlertsToday,
        autoToday,
        manualToday,
        falseAlertsToday,
        resolvedToday,
        alertsByHourAgg,
        responseTrendSource,
        topAreasSource
    ] = await Promise.all([
        activeAlertsPromise,
        alertsTodayPromise,
        autoTodayPromise,
        manualTodayPromise,
        falseAlertsTodayPromise,
        resolvedTodayPromise,
        alertsByHourPromise,
        responseTrendPromise,
        topAreasPromise
    ]);

    const avgResponseTimeSeconds = resolvedToday.length === 0
        ? 0
        : Math.round(
            resolvedToday.reduce((sum, alert) => {
                const createdAt = new Date(alert.createdAt).getTime();
                const resolvedAt = new Date(alert.resolvedAt).getTime();
                return sum + Math.max(0, Math.floor((resolvedAt - createdAt) / 1000));
            }, 0) / resolvedToday.length
        );

    const alertsByHour = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: 0
    }));

    alertsByHourAgg.forEach((entry) => {
        if (entry && Number.isInteger(entry._id) && alertsByHour[entry._id]) {
            alertsByHour[entry._id].count = entry.count;
        }
    });

    const responseByDate = new Map();
    responseTrendSource.forEach((alert) => {
        if (!alert.createdAt || !alert.resolvedAt) {
            return;
        }

        const key = new Date(alert.resolvedAt).toISOString().slice(0, 10);
        const duration = Math.max(
            0,
            Math.floor((new Date(alert.resolvedAt).getTime() - new Date(alert.createdAt).getTime()) / 1000)
        );
        const existing = responseByDate.get(key) || { total: 0, count: 0 };
        responseByDate.set(key, {
            total: existing.total + duration,
            count: existing.count + 1
        });
    });

    const responseTrend = [];
    for (let day = 6; day >= 0; day -= 1) {
        const date = new Date(startOfToday);
        date.setDate(date.getDate() - day);
        const key = date.toISOString().slice(0, 10);
        const aggregate = responseByDate.get(key);
        responseTrend.push({
            date: key,
            avg_response_time_seconds: aggregate ? Math.round(aggregate.total / aggregate.count) : 0
        });
    }

    const topAreasMap = new Map();
    topAreasSource.forEach((alert) => {
        if (!Number.isFinite(alert.initialLat) || !Number.isFinite(alert.initialLng)) {
            return;
        }

        const areaKey = `${alert.initialLat.toFixed(3)},${alert.initialLng.toFixed(3)}`;
        topAreasMap.set(areaKey, (topAreasMap.get(areaKey) || 0) + 1);
    });

    const top_alert_areas = [...topAreasMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([area, count]) => ({ area, count }));

    return {
        total_alerts_today: totalAlertsToday,
        active_alerts: activeAlerts,
        avg_response_time_seconds: avgResponseTimeSeconds,
        alerts_by_hour: alertsByHour,
        alerts_by_trigger_type: {
            auto: autoToday,
            manual: manualToday
        },
        response_time_trend: responseTrend,
        top_alert_areas,
        false_alerts_today: falseAlertsToday
    };
};

const emitStatsUpdate = async () => {
    const stats = await buildStatsPayload();
    emitDashboardEvent('dashboard:stats_update', stats);
};

const createSosAlert = async (req, res) => {
    const payload = req.body || {};

    const userName = String(payload.user_name || payload.userName || payload.name || 'Unknown User').trim();
    const phone = String(payload.phone || payload.phone_number || '').trim();
    const lat = asFiniteNumber(payload.lat);
    const lng = asFiniteNumber(payload.lng);
    const confidenceScore = asFiniteNumber(payload.confidence_score ?? payload.confidenceScore);
    const triggerType = normalizeTriggerType(payload.trigger_type || payload.triggerType);
    const incidentType = normalizeIncidentType(payload.incident_type || payload.incidentType);
    const callRequested = Boolean(payload.call_requested ?? payload.callRequested ?? false);
    const callRequestedAt = parseIsoDate(payload.call_requested_at || payload.callRequestedAt);
    const userId = payload.user_id || payload.userId || null;
    const alertTime = parseIsoDate(payload.timestamp) || new Date();

    if (!userName) {
        throw new BadRequestError('Please provide user_name');
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestError('Please provide valid lat and lng');
    }

    const alert = await SosAlert.create({
        userName,
        phone,
        userId: mongoose.Types.ObjectId.isValid(userId) ? userId : null,
        triggerType,
        incidentType,
        callRequested,
        callRequestedAt: callRequested ? (callRequestedAt || alertTime) : null,
        confidenceScore: triggerType === 'auto' ? confidenceScore : null,
        initialLat: lat,
        initialLng: lng,
        lastLocationLat: lat,
        lastLocationLng: lng,
        lastLocationTimestamp: alertTime,
        deviceId: payload.device_id || payload.deviceId || null,
        createdAt: alertTime
    });

    await LocationUpdate.create({
        sosId: alert._id,
        lat,
        lng,
        timestamp: alertTime
    });

    emitDashboardEvent('sos:new', serializeAlert(alert.toObject()));
    await emitStatsUpdate();

    res.status(StatusCodes.CREATED).json({
        sos_id: String(alert._id),
        status: 'received',
        timestamp: alert.createdAt.toISOString()
    });
};

const getAlerts = async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const statusFilter = normalizeStatusFilter(req.query.status);
    const incidentTypeFilter = normalizeIncidentTypeFilter(req.query.incident_type || req.query.incidentType);
    const dateRange = getDateRangeFilter(req.query.from, req.query.to);
    const triggerType = req.query.trigger_type || req.query.triggerType;

    const query = {
        ...statusFilter,
        ...incidentTypeFilter
    };

    if (dateRange) {
        query.createdAt = dateRange;
    }

    if (triggerType && ['auto', 'manual'].includes(String(triggerType).toLowerCase())) {
        query.triggerType = String(triggerType).toLowerCase();
    }

    const [total, alerts] = await Promise.all([
        SosAlert.countDocuments(query),
        SosAlert.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean()
    ]);

    const serialized = alerts
        .map(serializeAlert)
        .sort((a, b) => {
            const left = STATUS_ORDER[a.status] ?? 99;
            const right = STATUS_ORDER[b.status] ?? 99;
            if (left !== right) {
                return left - right;
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

    res.status(StatusCodes.OK).json({
        alerts: serialized,
        total,
        page,
        limit
    });
};

const getAlertById = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    const [alert, updates] = await Promise.all([
        SosAlert.findById(id).lean(),
        LocationUpdate.find({ sosId: id }).sort({ timestamp: 1 }).lean()
    ]);

    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    return res.status(StatusCodes.OK).json(serializeAlertDetail(alert, updates));
};

const acknowledgeAlert = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    const operatorName = String(
        req.body.operator_name ||
        req.body.operatorName ||
        req.operator?.name ||
        DEFAULT_OPERATOR
    ).trim();

    const alert = await SosAlert.findById(id);
    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    if (alert.status === 'resolved') {
        return res.status(StatusCodes.BAD_REQUEST).json({ msg: 'Resolved alerts cannot be acknowledged' });
    }

    if (alert.status !== 'acknowledged') {
        alert.status = 'acknowledged';
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = operatorName;
        await alert.save();
    }

    emitDashboardEvent('sos:acknowledged', {
        sos_id: String(alert._id),
        acknowledged_at: alert.acknowledgedAt?.toISOString() || new Date().toISOString(),
        acknowledged_by: alert.acknowledgedBy || operatorName
    });
    await emitStatsUpdate();

    return res.status(StatusCodes.OK).json({ alert: serializeAlert(alert.toObject()) });
};

const resolveAlert = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    const operatorName = String(
        req.body.resolved_by ||
        req.body.resolvedBy ||
        req.operator?.name ||
        DEFAULT_OPERATOR
    ).trim();
    const notes = typeof req.body.notes === 'string' ? req.body.notes.trim() : '';
    const falseAlert = Boolean(req.body.false_alert ?? req.body.falseAlert ?? false);

    const alert = await SosAlert.findById(id);
    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    if (alert.status !== 'resolved') {
        alert.status = 'resolved';
        alert.resolvedAt = new Date();
    }

    alert.resolvedBy = operatorName || alert.resolvedBy;
    alert.falseAlert = falseAlert;
    if (notes) {
        alert.notes = notes;
    }

    await alert.save();

    emitDashboardEvent('sos:resolved', {
        sos_id: String(alert._id),
        resolved_at: alert.resolvedAt?.toISOString() || new Date().toISOString(),
        resolved_by: alert.resolvedBy
    });
    await emitStatsUpdate();

    return res.status(StatusCodes.OK).json({ alert: serializeAlert(alert.toObject()) });
};

const saveAlertNotes = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    if (typeof req.body.notes !== 'string') {
        throw new BadRequestError('Please provide notes');
    }

    const alert = await SosAlert.findByIdAndUpdate(
        id,
        { notes: req.body.notes.trim() },
        { new: true }
    ).lean();

    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    return res.status(StatusCodes.OK).json({ alert: serializeAlert(alert) });
};

const sendUserNote = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
        throw new BadRequestError('Please provide message');
    }

    const alert = await SosAlert.findById(id);
    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    const note = {
        message,
        sentAt: new Date(),
        sentBy: {
            operatorId: req.operator?.id || null,
            operatorName: req.operator?.name || DEFAULT_OPERATOR
        }
    };
    alert.userNotes.push(note);
    await alert.save();

    const savedNote = alert.userNotes[alert.userNotes.length - 1];
    const payload = {
        sos_id: String(alert._id),
        note: serializeUserNote(savedNote)
    };
    emitDashboardEvent('sos:user_note', payload);

    return res.status(StatusCodes.OK).json({
        success: true,
        note: payload.note
    });
};

const getUserNotes = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    const alert = await SosAlert.findById(id).lean();
    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    const userPhone = req.user?.phoneNumber;
    if (!phoneMatches(alert.phone, userPhone)) {
        return res.status(StatusCodes.FORBIDDEN).json({ msg: 'Access denied for this alert' });
    }

    const sinceDate = parseIsoDate(req.query.since);
    const notes = Array.isArray(alert.userNotes) ? alert.userNotes : [];
    const filtered = sinceDate
        ? notes.filter((note) => note.sentAt && new Date(note.sentAt).getTime() > sinceDate.getTime())
        : notes;

    const serialized = filtered
        .sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime())
        .map(serializeUserNote);

    return res.status(StatusCodes.OK).json({ notes: serialized });
};

const addAlertLocationUpdate = async (req, res) => {
    const { id } = req.params;
    ensureObjectId(id);

    const lat = asFiniteNumber(req.body.lat);
    const lng = asFiniteNumber(req.body.lng);
    const timestamp = parseIsoDate(req.body.timestamp) || new Date();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new BadRequestError('Please provide valid lat and lng');
    }

    const alert = await SosAlert.findById(id);
    if (!alert) {
        return res.status(StatusCodes.NOT_FOUND).json({ msg: 'Alert not found' });
    }

    alert.lastLocationLat = lat;
    alert.lastLocationLng = lng;
    alert.lastLocationTimestamp = timestamp;
    await alert.save();

    await LocationUpdate.create({
        sosId: alert._id,
        lat,
        lng,
        timestamp
    });

    emitDashboardEvent('sos:location_update', {
        sos_id: String(alert._id),
        lat,
        lng,
        timestamp: timestamp.toISOString()
    });

    return res.status(StatusCodes.CREATED).json({
        sos_id: String(alert._id),
        lat,
        lng,
        timestamp: timestamp.toISOString()
    });
};

const getStats = async (req, res) => {
    const stats = await buildStatsPayload();
    res.status(StatusCodes.OK).json(stats);
};

const getHealth = async (req, res) => {
    res.status(StatusCodes.OK).json({
        status: 'ok',
        service: 'dashboard',
        timestamp: new Date().toISOString()
    });
};

module.exports = {
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
};
