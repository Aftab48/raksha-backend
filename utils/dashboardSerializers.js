const serializeAlert = (alert) => {
    if (!alert) {
        return null;
    }

    return {
        id: String(alert._id),
        sos_id: String(alert._id),
        user_name: alert.userName,
        phone: alert.phone || '',
        trigger_type: alert.triggerType,
        confidence_score: alert.confidenceScore,
        status: alert.status,
        initial_lat: alert.initialLat,
        initial_lng: alert.initialLng,
        last_lat: alert.lastLocationLat,
        last_lng: alert.lastLocationLng,
        last_location_at: alert.lastLocationTimestamp?.toISOString?.() || null,
        created_at: alert.createdAt?.toISOString?.() || null,
        acknowledged_at: alert.acknowledgedAt?.toISOString?.() || null,
        acknowledged_by: alert.acknowledgedBy || null,
        resolved_at: alert.resolvedAt?.toISOString?.() || null,
        resolved_by: alert.resolvedBy || null,
        notes: alert.notes || '',
        false_alert: Boolean(alert.falseAlert),
        device_id: alert.deviceId || null
    };
};

const serializeLocationUpdate = (update) => ({
    lat: update.lat,
    lng: update.lng,
    timestamp: update.timestamp?.toISOString?.() || null
});

const serializeAlertDetail = (alert, locationUpdates = []) => ({
    ...serializeAlert(alert),
    location_updates: locationUpdates.map(serializeLocationUpdate)
});

module.exports = {
    serializeAlert,
    serializeAlertDetail
};
