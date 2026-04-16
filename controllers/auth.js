const { StatusCodes } = require('http-status-codes');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const PendingRegistration = require('../models/pendingRegistration');
const { BadRequestError, UnAuthenticatedError } = require('../ErrorHandlers');
const { hashOtp, verifyOtpHash, sendOtpEmail, sendOtpSMS } = require('../services/otp');

const REGISTRATION_TTL_MINUTES = 10;
const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const phoneRegex = /^\+?\d{10,13}$/;


//create JWT token
const createAuthToken = (user) => jwt.sign(
    {
        userId: user._id,
        phoneNumber: user.phoneNumber
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
);

// Validate registration input and throw errors if invalid
const validateRegistrationPayload = ({ userName, email, password, phoneNumber }) => {
    if (!userName || !email || !password || !phoneNumber) {
        throw new BadRequestError('Please provide all required registration fields');
    }

    if (!emailRegex.test(email.trim().toLowerCase())) {
        throw new BadRequestError('Please provide a valid email');
    }

    if (!phoneRegex.test(phoneNumber.trim())) {
        throw new BadRequestError('Please provide a valid 10-digit phone number');
    }

    if (password.length < 6) {
        throw new BadRequestError('Password must be at least 6 characters long');
    }
};

// Mask email and phone for response, we don't want to expose full values in case of any logs or leaks
const getMaskedValue = (value, type) => {
    if (type === 'email') {
        const [name, domain] = value.split('@');
        return `${name.slice(0, 2)}***@${domain}`;
    }

    return `${value.slice(0, 2)}******${value.slice(-2)}`;
};

// Ensure the pending registration is valid and not expiredor else throw appropriate errors
const ensureRegistrationIsActive = async (registrationId) => {
    if (!registrationId) {
        throw new BadRequestError('Please provide registrationId');
    }

    const pendingRegistration = await PendingRegistration.findById(registrationId);

    if (!pendingRegistration) {
        throw new BadRequestError('Registration session not found or expired');
    }

    if (pendingRegistration.expiresAt.getTime() < Date.now()) {
        await PendingRegistration.findByIdAndDelete(pendingRegistration._id);
        throw new BadRequestError('Registration session expired. Please register again');
    }

    return pendingRegistration;
};

// intialize registration by validating input, checking for existing users, creating pending registration with OTP hashes, and sending OTPs to email and phone
const registerInit = async (req, res) => {
    const { userName, email, password, phoneNumber } = req.body;
    validateRegistrationPayload({ userName, email, password, phoneNumber });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phoneNumber.trim();

    const existingUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }]
    });

    if (existingUser) {
        if (existingUser.email === normalizedEmail) {
            throw new BadRequestError('Email already registered');
        }

        throw new BadRequestError('Phone number already registered');
    }

    await PendingRegistration.deleteMany({
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }]
    });

    const emailOtp = (await sendOtpEmail(normalizedEmail, 'registration')).otp;

    const mobileOtp = await sendOtpSMS(normalizedPhone);

    const expiresAt = new Date(Date.now() + REGISTRATION_TTL_MINUTES * 60 * 1000);

    const pendingRegistration = await PendingRegistration.create({
        userName: userName.trim(),
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        password,
        emailOtpHash: hashOtp(emailOtp),
        mobileOtpHash: hashOtp(mobileOtp),
        expiresAt
    });

    res.status(StatusCodes.CREATED).json({
        message: 'Registration initiated. Verify your email and mobile OTP to continue',
        registrationId: pendingRegistration._id,
        expiresAt,
        email: getMaskedValue(normalizedEmail, 'email'),
        phoneNumber: getMaskedValue(normalizedPhone, 'phone')
    });
};

//verify email otp while checking the pending registration status and incrementing OTP attempts on failure, if OTP is valid mark email as verified
const verifyEmailOtp = async (req, res) => {
    const { registrationId, otp } = req.body;
    const pendingRegistration = await ensureRegistrationIsActive(registrationId);

    if (!otp) {
        throw new BadRequestError('Please provide email OTP');
    }

    if (pendingRegistration.emailVerified) {
        return res.status(StatusCodes.OK).json({
            message: 'Email OTP already verified',
            emailVerified: true
        });
    }

    const isValid = verifyOtpHash(otp, pendingRegistration.emailOtpHash);

    if (!isValid) {
        pendingRegistration.emailOtpAttempts += 1;

        if (pendingRegistration.emailOtpAttempts >= pendingRegistration.maxOtpAttempts) {
            await PendingRegistration.findByIdAndDelete(pendingRegistration._id);
            throw new UnAuthenticatedError('Too many invalid email OTP attempts. Please register again');
        }

        await pendingRegistration.save();
        throw new UnAuthenticatedError('Invalid email OTP');
    }

    pendingRegistration.emailVerified = true;
    await pendingRegistration.save();

    res.status(StatusCodes.OK).json({
        message: 'Email OTP verified successfully',
        emailVerified: true
    });
};

//verify mobile otp while checking the pending registration status and incrementing OTP attempts on failure, if OTP is valid mark mobile as verified
const verifyMobileOtp = async (req, res) => {
    const { registrationId, otp } = req.body;
    const pendingRegistration = await ensureRegistrationIsActive(registrationId);

    if (!otp) {
        throw new BadRequestError('Please provide mobile OTP');
    }

    if (pendingRegistration.mobileVerified) {
        return res.status(StatusCodes.OK).json({
            message: 'Mobile OTP already verified',
            mobileVerified: true
        });
    }

    const isValid = verifyOtpHash(otp, pendingRegistration.mobileOtpHash);
    
    if (!isValid) {
        pendingRegistration.mobileOtpAttempts += 1;
        if (pendingRegistration.mobileOtpAttempts >= pendingRegistration.maxOtpAttempts) {
            await PendingRegistration.findByIdAndDelete(pendingRegistration._id);
            throw new UnAuthenticatedError('Too many invalid mobile OTP attempts. Please register again');
        }
        await pendingRegistration.save();
        throw new UnAuthenticatedError('Invalid mobile OTP');
    }

    pendingRegistration.mobileVerified = true;
    await pendingRegistration.save();

    res.status(StatusCodes.OK).json({
        message: 'Mobile OTP verified successfully',
        mobileVerified: true
    });
}


//complete registration by copying the pending registration details
const completeRegistration = async (req, res) => {
    const { registrationId } = req.body;
    const pendingRegistration = await ensureRegistrationIsActive(registrationId);

    if (!pendingRegistration.emailVerified) {
        throw new BadRequestError('Please verify your email OTP before completing registration');
    }
    if (!pendingRegistration.mobileVerified) {
        throw new BadRequestError('Please verify your mobile OTP before completing registration');
    }

    const existingUser = await User.findOne({
        $or: [
            { email: pendingRegistration.email },
            { phoneNumber: pendingRegistration.phoneNumber }
        ]
    });

    if (existingUser) {
        await PendingRegistration.findByIdAndDelete(pendingRegistration._id);
        throw new BadRequestError('User already exists with this email or phone number');
    }

    const user = await User.create({
        userName: pendingRegistration.userName,
        email: pendingRegistration.email,
        phoneNumber: pendingRegistration.phoneNumber,
        password: pendingRegistration.password
    });

    await PendingRegistration.findByIdAndDelete(pendingRegistration._id);

    const token = createAuthToken(user);

    res.status(StatusCodes.CREATED).json({
        message: 'Registration completed successfully',
        token
    });
};

const login = async (req, res) => {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
        throw new BadRequestError('Please provide all credentials');
    }

    const user = await User.findOne({ phoneNumber: phoneNumber.trim() });
    if (!user) {
        throw new UnAuthenticatedError('Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
        throw new UnAuthenticatedError('Invalid credentials');
    }

    const token = createAuthToken(user);
    res.status(StatusCodes.OK).json({ token });
};

module.exports = {
    registerInit,
    verifyEmailOtp,
    verifyMobileOtp,
    completeRegistration,
    login
};
