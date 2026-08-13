import { z } from "zod";

export const scheduleRequestSchema = z.object({
  senderId: z.string().uuid(),
  recipients: z.array(z.string().email()).min(1, "at least one recipient required"),
  subject: z.string().min(1),
  body: z.string().min(1),
  // ISO 8601 string, e.g. "2025-08-13T10:00:00.000Z"
  startTime: z.string().datetime(),
  // ms delay enforced between each successive email in this batch
  delayBetweenMs: z.number().int().min(0).default(2000),
  // optional per-batch override; falls back to env MAX_EMAILS_PER_HOUR_PER_SENDER if omitted
  hourlyLimit: z.number().int().min(1).optional(),
});

export type ScheduleRequest = z.infer<typeof scheduleRequestSchema>;

// Payload stored on the BullMQ job itself — worker reads this, not the DB,
// to avoid an extra round trip for the fields it needs immediately.
export interface EmailJobPayload {
  emailJobId: string;
  senderId: string;
  hourlyLimit: number;
}