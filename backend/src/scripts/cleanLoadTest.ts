import { prisma } from "../lib/prisma";
import { Queue } from "bullmq";
import IORedis from "ioredis";

async function main() {
  // 1. Find all load-test email jobs (recipients matching load-test-user-*@example.test)
  const loadTestJobs = await prisma.emailJob.findMany({
    where: {
      recipient: { startsWith: "load-test-user-" },
    },
    select: { id: true, bullmqJobId: true, batchId: true },
  });

  const batchIds = [...new Set(loadTestJobs.map((j) => j.batchId))];
  const jobIds = loadTestJobs.map((j) => j.id);

  console.log(`Found ${loadTestJobs.length} load-test email jobs across ${batchIds.length} batch(es).`);

  if (loadTestJobs.length === 0) {
    console.log("Nothing to clean up.");
    await prisma.$disconnect();
    return;
  }

  // 2. Delete them from the database
  const deleted = await prisma.emailJob.deleteMany({
    where: { id: { in: jobIds } },
  });
  console.log(`Deleted ${deleted.count} rows from EmailJob table.`);

  // 3. Drain matching jobs from the BullMQ queue
  const connection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
  });

  // 3. Obliterate queue and reconcile real pending jobs from DB
  await queue.obliterate({ force: true });
  console.log("Obliterated BullMQ Redis queue.");

  const activeJobs = await prisma.emailJob.findMany({
    where: { status: { in: ["pending", "queued", "delayed"] } },
  });
  for (const job of activeJobs) {
    const delay = Math.max(0, new Date(job.scheduledAt).getTime() - Date.now());
    await queue.add(
      "send-email",
      { emailJobId: job.id, recipient: job.recipient, senderId: job.senderId },
      { jobId: `email-job-${job.id}`, delay }
    );
  }
  console.log(`Preserved and restored ${activeJobs.length} active scheduled DB jobs.`);

  // 4. Clean up rate limit keys
  const keys = await connection.keys("ratelimit:*");
  if (keys.length > 0) {
    await connection.del(...keys);
    console.log(`Cleared ${keys.length} rate-limit Redis key(s).`);
  }

  await queue.close();
  await connection.quit();
  await prisma.$disconnect();

  console.log("\nLoad test cleanup complete. Your real emails are untouched.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
