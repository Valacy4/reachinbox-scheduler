import nodemailer from "nodemailer";

async function main() {
  const account = await nodemailer.createTestAccount();
  console.log("user:", account.user);
  console.log("pass:", account.pass);

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: account.user, pass: account.pass },
  });

  const info = await transporter.sendMail({
    from: '"ReachInbox Scheduler" <scheduler@reachinbox.test>',
    to: "test-recipient@example.com",
    subject: "Ethereal setup check",
    html: "<p>SMTP is working.</p>",
  });

  console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
}

main().catch(console.error);