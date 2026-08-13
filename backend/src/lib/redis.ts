import IORedis from "ioredis";
import { env } from "../config/env";

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
export const connection = new IORedis(env.redisPort, env.redisHost, {
  maxRetriesPerRequest: null,
});

connection.on("error", (err) => {
  console.error("[redis] connection error:", err.message);
});