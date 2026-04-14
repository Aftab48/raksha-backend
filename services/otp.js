const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const generateOTP = require('../utils/generateOtp');

const hashOtp = (otp) => {
    return crypto.createHash('sha256').update(otp).digest('hex');
};

const verifyOtpHash = (otp, otpHash) => {
    const incomingHash = hashOtp(otp);
    return crypto.timingSafeEqual(
        Buffer.from(incomingHash, 'hex'),
        Buffer.from(otpHash, 'hex')
    );
};

const buildOtpHtml = (otp, purpose) => `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>SafeSphere verification</h2>
        <p>Your OTP for <b>${purpose}</b> is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this code, you can ignore this email.</p>
    </div>
`;

const sendOtpEmail = async (email, purpose = 'register') => {
    const otp = generateOTP();
    const subject = 'Your OTP for SafeSphere';
    const html = buildOtpHtml(otp, purpose);
    const info = await sendEmail(email, subject, html);

    return { otp, info };
};

const sendOtpSMS = async (phoneNumber, otp) => {
    // Replace this with a real provider such as Twilio, MSG91, or AWS SNS.
    console.log(`Sending OTP ${otp} to phone number: ${phoneNumber}`);
};

module.exports = {
    hashOtp,
    verifyOtpHash,
    sendOtpEmail,
    sendOtpSMS
};
