import { Queue } from "bullmq";
import { connection } from "./redis";

export const EMAIL_QUEUE_NAME = "email-sending";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    // Keep a bounded history in Redis instead of growing forever.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

/** Deterministic job id — re-adding the same EmailJob id is a safe no-op in BullMQ. */
export function jobIdFor(emailJobId: string): string {
  return `email-job-${emailJobId}`;
}