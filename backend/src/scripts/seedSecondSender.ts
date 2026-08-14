import { prisma } from "../lib/prisma";

async function main() {
  const email = process.env.SEED_SENDER_EMAIL;
  const pass = process.env.SEED_SENDER_PASS;
  const name = process.env.SEED_SENDER_NAME || "Second Sender";

  if (!email || !pass) {
    throw new Error(
      "Please set SEED_SENDER_EMAIL and SEED_SENDER_PASS in your environment before running this script.\n" +
      "Example:\n" +
      '  $env:SEED_SENDER_EMAIL="your-user@ethereal.email"; $env:SEED_SENDER_PASS="your-pass"; npx ts-node-dev --transpile-only src/scripts/seedSecondSender.ts'
    );
  }

  const sender = await prisma.sender.create({
    data: {
      name,
      email,
      smtpHost: "smtp.ethereal.email",
      smtpPort: 587,
      smtpUser: email,
      smtpPass: pass,
    },
  });

  console.log("Created sender:", sender.email, "| ID:", sender.id);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
