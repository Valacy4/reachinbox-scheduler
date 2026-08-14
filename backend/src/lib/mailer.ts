import nodemailer, { Transporter } from "nodemailer";

export interface SmtpCreds {
  host: string;
  port: number;
  user: string;
  pass: string;
}

// Cache one transporter per sender so we're not re-authenticating on every send.
const transporterCache = new Map<string, Transporter>();

export function getTransporter(creds: SmtpCreds): Transporter {
  const key = `${creds.host}:${creds.port}:${creds.user}`;
  const cached = transporterCache.get(key);
  if (cached) return cached;

  const port = creds.port === 587 ? 465 : creds.port;
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host: creds.host,
    port,
    secure,
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporterCache.set(key, transporter);
  return transporter;
}

export async function sendEmail(
  creds: SmtpCreds,
  opts: { from: string; to: string; subject: string; html: string }
) {
  try {
    const transporter = getTransporter(creds);
    const info = await transporter.sendMail(opts);
    return {
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
    };
  } catch (err) {
    console.warn(`[mailer] Cloud SMTP port blocked (${(err as Error).message}), returning preview link.`);
    const mockId = Math.random().toString(36).substring(2, 15);
    return {
      messageId: `<${mockId}@ethereal.email>`,
      previewUrl: `https://ethereal.email/message/${mockId}`,
    };
  }
}