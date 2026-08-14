import dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  frontendUrl: required("FRONTEND_URL", "http://localhost:3000"),

  databaseUrl: required("DATABASE_URL"),

  redisUrl: process.env.REDIS_URL,
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: parseInt(process.env.REDIS_PORT ?? "6379", 10),

  ethereal: {
    host: required("ETHEREAL_HOST", "smtp.ethereal.email"),
    port: parseInt(process.env.ETHEREAL_PORT ?? "587", 10),
    user: process.env.ETHEREAL_USER ?? "",
    pass: process.env.ETHEREAL_PASS ?? "",
  },

  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10),
    minDelayBetweenEmailsMs: parseInt(
      process.env.MIN_DELAY_BETWEEN_EMAILS_MS ?? "2000",
      10
    ),
    maxEmailsPerHourPerSender: parseInt(
      process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? "200",
      10
    ),
  },
};