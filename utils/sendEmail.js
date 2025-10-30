import transporter from '../config/nodemailer.js';

export const sendEmail = async (options) => {
  const message = {
    from: process.env.SMTP_HOST,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  console.log(process.env.SMTP_USER, process.env.SMTP_PASS);

  await transporter.sendMail(message);
};

export const emailTemplates = {
  verification: (name, code) => `
    <div>
      <h2>Welcome to Annanewa Farming Media!</h2>
      <p>Hello ${name},</p>
      <p>Your verification code: <strong>${code}</strong></p>
      <p>This code expires in 10 minutes.</p>
    </div>
  `,
  
  resetPassword: (name, code) => `
    <div>
      <h2>Password Reset</h2>
      <p>Hello ${name},</p>
      <p>Your reset code: <strong>${code}</strong></p>
      <p>This code expires in 10 minutes.</p>
    </div>
  `,
};