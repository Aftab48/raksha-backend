const mongoose = require('mongoose');
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: [true, 'Please provide a username']
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: [true, 'Email already exists'],
        match: [/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters long']
    },
    phoneNumber: {
        type: String,
        required: [true, 'Please provide a phone number'],
        unique: [true, 'Phone number already exists'],
        match: [/^\+?\d{10,13}$/, 'Please provide a valid 10-digit phone number']
    },
    trustedContacts: [{
        name: {
            type: String
        },
        phoneNumber: {
            type: String,
            match: [/^\+?\d{10,13}$/, 'Please provide a valid 10-digit phone number'],
        },
        priority: {
            type: Number,
            required: [true, 'Please provide a priority for the trusted contact'],
        }
    }],
    sosSettings: {
        autoCall: { type: Boolean, default: false },
        autoSMS: { type: Boolean, default: true }
    },
    fcmToken: {
        type: String
    }
}, {
    timestamps: true
});


userSchema.pre("save", async function() {
    if (!this.isModified("password")) return;
    if (this.password.startsWith('$2')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(givenPassword) {
    return await bcrypt.compare(givenPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
