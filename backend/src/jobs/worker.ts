import { Worker, DelayedError } from "bullmq";
import { connection } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendEmail } from "../lib/mailer";
import { EMAIL_QUEUE_NAME } from "../lib/queue";
import { tryConsumeSlot, nextWindowStart } from "../lib/rateLimiter";
import { env } from "../config/env";
import type { EmailJobPayload } from "../types/schedule";

const worker = new Worker<EmailJobPayload>(
  EMAIL_QUEUE_NAME,
  async (job, token) => {
    const { emailJobId, senderId, hourlyLimit } = job.data;

    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: { sender: true },
    });

    if (!emailJob) {
      console.warn(`[worker] EmailJob ${emailJobId} not found in DB, skipping`);
      return;
    }

    // Idempotency guard: if this row is already marked sent (e.g. a duplicate
    // enqueue after a crash/reconcile race), do nothing.
    if (emailJob.status === "sent") {
      console.log(`[worker] ${emailJobId} already sent, skipping duplicate`);
      return;
    }

    // Hourly rate limit check (Redis-backed, safe across concurrent workers).
    const { allowed } = await tryConsumeSlot(senderId, hourlyLimit);
    if (!allowed) {
      const nextStart = nextWindowStart(Date.now());
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "delayed", scheduledAt: new Date(nextStart) },
      });
      console.log(
        `[worker] rate limit hit for sender ${senderId}, pushing ${emailJobId} to ${new Date(
          nextStart
        ).toISOString()}`
      );
      // Correct BullMQ idiom for "reschedule myself, don't count as a failure":
      await job.moveToDelayed(nextStart, token);
      throw new DelayedError();
    }

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: "sending", attempts: { increment: 1 } },
    });

    try {
      const result = await sendEmail(
        {
          host: emailJob.sender.smtpHost,
          port: emailJob.sender.smtpPort,
          user: emailJob.sender.smtpUser,
          pass: emailJob.sender.smtpPass,
        },
        {
          from: emailJob.sender.email,
          to: emailJob.recipient,
          subject: emailJob.subject,
          html: emailJob.body,
        }
      );

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: "sent",
          sentAt: new Date(),
          previewUrl: result.previewUrl || null,
        },
      });

      console.log(`[worker] sent ${emailJobId} -> ${emailJob.recipient} (${result.previewUrl})`);
    } catch (err) {
      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: { status: "failed", lastError: err instanceof Error ? err.message : String(err) },
      });
      // rethrow so BullMQ applies its retry/backoff policy from defaultJobOptions
      throw err;
    }
  },
  {
    connection,
    concurrency: env.worker.concurrency,
    // Global floor on send rate regardless of concurrency - satisfies the
    // "minimum delay between individual email sends" requirement.
    limiter: {
      max: 1,
      duration: env.worker.minDelayBetweenEmailsMs,
    },
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});

console.log(
  `[worker] started - concurrency=${env.worker.concurrency}, minDelayMs=${env.worker.minDelayBetweenEmailsMs}`
);