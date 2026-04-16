const mongoose = require('mongoose');
const User = require('./user');

const policeAlertSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: [true, "User reference is required"] 
    },
    location: {
        type: String,
        required: [true, "Location is required"]
    },
    phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        match: [/^\+?\d{10,13}$/, 'Please provide a valid 10-digit phone number']
    },
    alertTime: {
        type: Date,
        default: Date.now
    },
    audioRecordingUrl: {
        type: String,
        required: [true, "Audio recording URL is required"]
    },
    VideoRecordingUrl: {
        type: String,
        required: [true, "Video recording URL is required"]
    }
    
})

module.exports = mongoose.model('PoliceAlert', policeAlertSchema);