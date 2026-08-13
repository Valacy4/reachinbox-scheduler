import { prisma } from "../lib/prisma";

async function main() {
  const batchId = process.argv[2];
  if (!batchId) {
    throw new Error("Usage: npx ts-node-dev --transpile-only src/scripts/checkBatch.ts <batchId>");
  }

  const counts = await prisma.emailJob.groupBy({
    by: ["status"],
    where: { batchId },
    _count: { _all: true },
  });

  let total = 0;
  console.log(`Status breakdown for batch ${batchId}:`);
  for (const row of counts) {
    console.log(`  ${row.status}: ${row._count._all}`);
    total += row._count._all;
  }
  console.log(`  TOTAL: ${total}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});