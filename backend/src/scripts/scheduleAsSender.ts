/**
 * One-off proof script for multi-sender support — bypasses the HTTP auth
 * layer by calling the same DB + queue logic /api/schedule uses internally.
 *
 * Run with: npx ts-node-dev --transpile-only src/scripts/scheduleAsSender.ts <senderId>
 */
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma";
import { emailQueue, jobIdFor } from "../lib/queue";
import type { EmailJobPayload } from "../types/schedule";

async function main() {
  const senderId = process.argv[2];
  if (!senderId) {
    throw new Error("Usage: npx ts-node-dev --transpile-only src/scripts/scheduleAsSender.ts <senderId>");
  }

  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) {
    throw new Error(`No sender found with id ${senderId}`);
  }

  const batchId = randomUUID();
  const scheduledAt = new Date(Date.now() + 10_000); // 10 seconds out

  const emailJob = await prisma.emailJob.create({
    data: {
      senderId,
      recipient: "multisender-test@test.com",
      subject: "Multi-sender proof",
      body: "<p>Sent via a second Ethereal sender.</p>",
      batchId,
      scheduledAt,
      delayMs: 0,
      status: "pending",
    },
  });

  const payload: EmailJobPayload = {
    emailJobId: emailJob.id,
    senderId,
    hourlyLimit: 200,
  };

  await emailQueue.add("send-email", payload, {
    jobId: jobIdFor(emailJob.id),
    delay: 10_000,
  });

  await prisma.emailJob.update({
    where: { id: emailJob.id },
    data: { status: "queued", bullmqJobId: jobIdFor(emailJob.id) },
  });

  console.log(`Scheduled via sender ${sender.email} (${senderId})`);
  console.log(`EmailJob id: ${emailJob.id}, sends in ~10s`);
  console.log("Watch your worker terminal for the [worker] sent ... line.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});