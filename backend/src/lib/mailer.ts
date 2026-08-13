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

  const transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: false, // Ethereal uses STARTTLS on 587
    auth: {
      user: creds.user,
      pass: creds.pass,
    },
  });

  transporterCache.set(key, transporter);
  return transporter;
}

export async function sendEmail(
  creds: SmtpCreds,
  opts: { from: string; to: string; subject: string; html: string }
) {
  const transporter = getTransporter(creds);
  const info = await transporter.sendMail(opts);
  return {
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl(info) || null,
  };
}