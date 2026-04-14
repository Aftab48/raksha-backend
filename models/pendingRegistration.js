const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const pendingRegistrationSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: [true, 'Please provide a username'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'],
            lowercase: true,
            trim: true
        },
        phoneNumber: {
            type: String,
            required: [true, 'Please provide a phone number'],
            trim: true
        },
        password: {
            type: String,
            required: [true, 'Please provide a password']
        },
        emailOtpHash: {
            type: String,
            required: [true, 'Email OTP hash is required']
        },
        mobileOtpHash: {
            type: String,
            required: [true, 'Mobile OTP hash is required']
        },
        emailVerified: {
            type: Boolean,
            default: false
        },
        mobileVerified: {
            type: Boolean,
            default: false
        },
        emailOtpAttempts: {
            type: Number,
            default: 0
        },
        mobileOtpAttempts: {
            type: Number,
            default: 0
        },
        maxOtpAttempts: {
            type: Number,
            default: 5
        },
        expiresAt: {
            type: Date,
            required: [true, 'Expiry is required']
        }
    },
    {
        timestamps: true
    }
);

pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

pendingRegistrationSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
