const mongoose = require('mongoose');

const sosAlertSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
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
    incidentType: {
        type: String,
        enum: ['sos', 'panic'],
        default: 'sos'
    },
    callRequested: {
        type: Boolean,
        default: false
    },
    callRequestedAt: {
        type: Date,
        default: null
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
    },
    userNotes: [{
        message: {
            type: String,
            required: true,
            trim: true
        },
        sentAt: {
            type: Date,
            default: Date.now
        },
        sentBy: {
            operatorId: {
                type: String,
                default: null
            },
            operatorName: {
                type: String,
                default: null
            }
        }
    }]
}, {
    timestamps: true
});

const normalizePhone = (value) => String(value || '').replace(/[^\d]/g, '');

sosAlertSchema.pre('save', function(next) {
    const normalizedAlertPhone = normalizePhone(this.phone);
    if (!normalizedAlertPhone) {
        this.phone = '';
        return next();
    }
    this.phone = normalizedAlertPhone.startsWith('91') && normalizedAlertPhone.length > 10
        ? normalizedAlertPhone
        : normalizedAlertPhone;
    next();
});

sosAlertSchema.methods.matchesUserPhone = function(phoneNumber) {
    const alertPhone = normalizePhone(this.phone);
    const userPhone = normalizePhone(phoneNumber);
    if (!alertPhone || !userPhone) {
        return false;
    }

    if (alertPhone === userPhone) {
        return true;
    }

    return alertPhone.slice(-10) === userPhone.slice(-10);
};

sosAlertSchema.index({ status: 1, createdAt: -1 });
sosAlertSchema.index({ createdAt: -1 });
sosAlertSchema.index({ triggerType: 1, createdAt: -1 });
sosAlertSchema.index({ incidentType: 1, createdAt: -1 });

module.exports = mongoose.model('SosAlert', sosAlertSchema);
