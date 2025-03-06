const transporter = require("../config/nodemailerConfig");

const otpStore = {}; // Store OTPs

async function sendOTP(email) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const emailTemplate = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Chippin - OTP Verification</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f4f4f4;
                            margin: 0;
                            padding: 0;
                        }
                        .container {
                            max-width: 400px;
                            background-color: #ffffff;
                            margin: 20px auto;
                            padding: 20px;
                            border-radius: 8px;
                            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                            text-align: center;
                        }
                        .logo {
                            font-size: 24px;
                            font-weight: bold;
                            color: #2a9d8f;
                        }
                        .otp-box {
                            font-size: 22px;
                            font-weight: bold;
                            color: #333;
                            padding: 10px 20px;
                            display: inline-block;
                            border: 2px dashed #2a9d8f;
                            border-radius: 5px;
                            background: #f1fdfb;
                            margin: 15px 0;
                        }
                        .message {
                            font-size: 16px;
                            color: #555;
                            margin-top: 10px;
                        }
                        .footer {
                            font-size: 12px;
                            color: #888;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="logo">Chippin</div>
                        <p class="message">Your One-Time Password (OTP) for verification is:</p>
                        <div class="otp-box">${otp}</div>
                        <!-- <div class="otp-box">547856</div> -->
                        <p class="message">This OTP is valid for only 10 minutes. Do not share it with anyone.</p>
                        <p class="footer">If you didn't request this, please ignore this email.</p>
                    </div>
                </body>
                </html>`

    const mailOptions = {
        from: '"Chippin Auth" <chippin.webapp@gmail.com>',
        to: email,
        subject: "Your Chippin OTP Code",
        html: emailTemplate,
    };

    await transporter.sendMail(mailOptions);

    const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry
    otpStore[email] = { otp, expiry, attempts: 0 };
    
    console.log(`OTP sent to ${email}: ${otp}`);
    return { message: "OTP sent to email!" };
}

module.exports = { sendOTP, otpStore };