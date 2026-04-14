const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST,
    port: process.env.BREVO_SMTP_PORT,
    secure: false,
    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY_SAFESPHERE
    }
});

const sendEmail = async(to, subject, html) => {
    const info = await transporter.sendMail({
        from: `"SafeSphere"<${process.env.BREVO_VERIFIED_EMAIL}>`,
        to,
        subject,
        html
    });
    return info;
}

module.exports = sendEmail;