import { prisma } from "../lib/prisma";
import { emailQueue, jobIdFor } from "../lib/queue";
import type { EmailJobPayload } from "../types/schedule";
import { env } from "../config/env";

/**
 * Runs once on API server boot. Covers the narrow crash window between
 * "DB row created" and "BullMQ job added" (e.g. process killed mid-request).
 * BullMQ jobs themselves live in Redis and survive server restarts on their
 * own - this only re-enqueues rows that never made it into the queue at all.
 * Safe to run repeatedly: jobIdFor() is deterministic, so re-adding an
 * already-queued job is a no-op in BullMQ.
 */
export async function reconcilePendingJobs() {
  const orphaned = await prisma.emailJob.findMany({
    where: { status: "pending" },
  });

  if (orphaned.length === 0) return;

  console.log(`[reconcile] re-enqueuing ${orphaned.length} orphaned job(s)`);

  for (const job of orphaned) {
    const payload: EmailJobPayload = {
      emailJobId: job.id,
      senderId: job.senderId,
      hourlyLimit: env.worker.maxEmailsPerHourPerSender,
    };
    const delay = Math.max(0, job.scheduledAt.getTime() - Date.now());

    await emailQueue.add("send-email", payload, {
      jobId: jobIdFor(job.id),
      delay,
    });

    await prisma.emailJob.update({
      where: { id: job.id },
      data: { status: "queued", bullmqJobId: jobIdFor(job.id) },
    });
  }
}