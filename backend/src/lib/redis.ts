import IORedis from "ioredis";
import { env } from "../config/env";

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
// Use REDIS_URL (Render) if available, otherwise host/port (local dev).
export const connection = env.redisUrl
  ? new IORedis(env.redisUrl, { maxRetriesPerRequest: null, tls: env.redisUrl.startsWith("rediss://") ? {} : undefined })
  : new IORedis({ host: env.redisHost, port: env.redisPort, maxRetriesPerRequest: null });

connection.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});