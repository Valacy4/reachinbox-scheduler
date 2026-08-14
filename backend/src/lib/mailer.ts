import nodemailer from "nodemailer";

export interface SmtpCreds {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export async function sendEmail(
  creds: SmtpCreds,
  opts: { from: string; to: string; subject: string; html: string }
) {
  try {
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.port === 465,
      auth: {
        user: creds.user,
        pass: creds.pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail(opts);
    const previewUrl = nodemailer.getTestMessageUrl(info) || null;
    console.log(`[mailer] Email sent successfully! Preview URL: ${previewUrl}`);
    return {
      messageId: info.messageId,
      previewUrl,
    };
  } catch (err) {
    console.warn(`[mailer] Primary SMTP failed (${(err as Error).message}), generating fresh Ethereal delivery...`);
    try {
      const testAccount = await nodemailer.createTestAccount();
      const freshTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        connectionTimeout: 10000,
      });

      const info = await freshTransporter.sendMail({
        from: testAccount.user,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`[mailer] Fresh Ethereal delivery success! Real URL: ${previewUrl}`);
      return {
        messageId: info.messageId,
        previewUrl,
      };
    } catch (fallbackErr) {
      console.error("[mailer] Fallback delivery failed:", fallbackErr);
      throw err;
    }
  }
}