import { prisma } from "../lib/prisma";

async function main() {
  const result = await prisma.emailJob.deleteMany({});
  console.log(`Deleted ${result.count} EmailJob rows. Sender rows untouched.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});