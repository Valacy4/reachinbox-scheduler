import http from "http";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";

const API_PORT = env.port;
const RECIPIENT_COUNT = 1000;
const TEST_HOURLY_LIMIT = 50; // deliberately low so the limiter triggers almost immediately
const POLL_INTERVAL_MS = 5000;
const POLL_ITERATIONS = 8; // ~40s of observation - enough to see the rate-limit path fire

function postJson(path: string, body: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: API_PORT,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode ?? 0, json: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode ?? 0, json: raw });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const sender = await prisma.sender.findFirst();
  if (!sender) {
    throw new Error("No Sender found - run seedSender.ts first.");
  }

  const recipients = Array.from(
    { length: RECIPIENT_COUNT },
    (_, i) => `load-test-user-${i}@example.test`
  );

  console.log(
    `Enqueuing ${RECIPIENT_COUNT} emails for sender ${sender.email}, hourlyLimit=${TEST_HOURLY_LIMIT}...`
  );

  const { status, json } = await postJson("/api/schedule", {
    senderId: sender.id,
    recipients,
    subject: "Load test",
    body: "<p>load test email</p>",
    startTime: new Date().toISOString(),
    delayBetweenMs: 0,
    hourlyLimit: TEST_HOURLY_LIMIT,
  });

  if (status !== 201) {
    console.error("Schedule request failed:", status, json);
    process.exit(1);
  }

  const batchId = json.batchId as string;
  console.log(`Batch ${batchId} created with ${json.scheduledCount} jobs.\n`);

  for (let i = 0; i < POLL_ITERATIONS; i++) {
    await sleep(POLL_INTERVAL_MS);

    const counts = await prisma.emailJob.groupBy({
      by: ["status"],
      where: { batchId },
      _count: { _all: true },
    });

    const summary: Record<string, number> = {};
    let total = 0;
    for (const row of counts) {
      summary[row.status] = row._count._all;
      total += row._count._all;
    }

    console.log(`[poll ${i + 1}/${POLL_ITERATIONS}] total=${total}`, JSON.stringify(summary));

    if (total !== RECIPIENT_COUNT) {
      console.warn(
        `  WARNING: total tracked (${total}) != recipients sent (${RECIPIENT_COUNT}) - some rows are missing.`
      );
    }
  }

  const finalCounts = await prisma.emailJob.groupBy({
    by: ["status"],
    where: { batchId },
    _count: { _all: true },
  });

  console.log("\nFinal status breakdown:");
  for (const row of finalCounts) {
    console.log(`  ${row.status}: ${row._count._all}`);
  }

  const sentRow = finalCounts.find((r: (typeof finalCounts)[number]) => r.status === "sent");
  const sentCount = sentRow?._count._all ?? 0;

  console.log(
    `\nCheck 1: sent (${sentCount}) should be <= hourlyLimit (${TEST_HOURLY_LIMIT}) for this first window.`
  );
  console.log(
    "Check 2: remaining jobs should show status 'delayed' (pushed to next hour) or 'queued' " +
      "(not reached yet) - none should be missing, and none should be 'failed' due to rate limiting."
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});