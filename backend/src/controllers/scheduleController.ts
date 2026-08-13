import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { emailQueue, jobIdFor } from "../lib/queue";
import { env } from "../config/env";
import { scheduleRequestSchema } from "../types/schedule";
import type { EmailJobPayload } from "../types/schedule";

export async function postSchedule(req: Request, res: Response) {
  const parsed = scheduleRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { senderId, recipients, subject, body, startTime, delayBetweenMs, hourlyLimit } =
    parsed.data;

  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) {
    return res.status(404).json({ error: `Sender ${senderId} not found` });
  }

  const effectiveHourlyLimit = hourlyLimit ?? env.worker.maxEmailsPerHourPerSender;
  const batchId = randomUUID();
  const startMs = new Date(startTime).getTime();
  const now = Date.now();

  const created: { id: string; recipient: string; scheduledAt: Date }[] = [];

  for (let i = 0; i < recipients.length; i++) {
    const scheduledAt = new Date(startMs + i * delayBetweenMs);

    const emailJob = await prisma.emailJob.create({
      data: {
        senderId,
        recipient: recipients[i],
        subject,
        body,
        batchId,
        scheduledAt,
        delayMs: delayBetweenMs,
        status: "pending",
      },
    });

    const payload: EmailJobPayload = {
      emailJobId: emailJob.id,
      senderId,
      hourlyLimit: effectiveHourlyLimit,
    };

    const delay = Math.max(0, scheduledAt.getTime() - now);

    await emailQueue.add("send-email", payload, {
      jobId: jobIdFor(emailJob.id),
      delay,
    });

    await prisma.emailJob.update({
      where: { id: emailJob.id },
      data: { status: "queued", bullmqJobId: jobIdFor(emailJob.id) },
    });

    created.push({ id: emailJob.id, recipient: emailJob.recipient, scheduledAt });
  }

  return res.status(201).json({
    batchId,
    scheduledCount: created.length,
    hourlyLimit: effectiveHourlyLimit,
    jobs: created,
  });
}

/** Debug/verification helper for hour 4-12 testing - full listing endpoints come later. */
export async function getBatch(req: Request, res: Response) {
  const { batchId } = req.params;
  const jobs = await prisma.emailJob.findMany({
    where: { batchId },
    orderBy: { scheduledAt: "asc" },
  });
  return res.json({ batchId, count: jobs.length, jobs });
}