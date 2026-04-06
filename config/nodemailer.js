import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "setulalchowhan@gmail.com",
    pass: "qmdhixwhmxquoiwm",
  },
});

export default transporter;
