const mongoose = require('mongoose');

const sosAlertSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        default: ''
    },
    triggerType: {
        type: String,
        enum: ['auto', 'manual'],
        default: 'manual'
    },
    confidenceScore: {
        type: Number,
        default: null
    },
    initialLat: {
        type: Number,
        required: true
    },
    initialLng: {
        type: Number,
        required: true
    },
    lastLocationLat: {
        type: Number,
        required: true
    },
    lastLocationLng: {
        type: Number,
        required: true
    },
    lastLocationTimestamp: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'acknowledged', 'resolved'],
        default: 'active'
    },
    acknowledgedAt: {
        type: Date,
        default: null
    },
    acknowledgedBy: {
        type: String,
        default: null
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: String,
        default: null
    },
    notes: {
        type: String,
        default: ''
    },
    falseAlert: {
        type: Boolean,
        default: false
    },
    deviceId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

sosAlertSchema.index({ status: 1, createdAt: -1 });
sosAlertSchema.index({ createdAt: -1 });
sosAlertSchema.index({ triggerType: 1, createdAt: -1 });

module.exports = mongoose.model('SosAlert', sosAlertSchema);
