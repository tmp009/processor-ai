require('dotenv').config();

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASSWORD
    }
  });

async function sendMail(recipient, subject, text, attachments=[]) {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipient,
        subject: subject,
        text: text,
        attachments: attachments
    };
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            throw error;
        }
    })
}

module.exports = { sendMail }