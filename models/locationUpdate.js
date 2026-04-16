const mongoose = require('mongoose');

const locationUpdateSchema = new mongoose.Schema({
    sosId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SosAlert',
        required: true,
        index: true
    },
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    timestamp: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

locationUpdateSchema.index({ sosId: 1, timestamp: 1 });

module.exports = mongoose.model('LocationUpdate', locationUpdateSchema);
