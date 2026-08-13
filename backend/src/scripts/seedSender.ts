import { prisma } from "../lib/prisma";
import { env } from "../config/env";

async function main() {
  if (!env.ethereal.user || !env.ethereal.pass) {
    throw new Error(
      "Set ETHEREAL_USER / ETHEREAL_PASS in .env first (run `npm run test:ethereal`)."
    );
  }

  const sender = await prisma.sender.upsert({
    where: { email: env.ethereal.user },
    update: {},
    create: {
      name: "Default Test Sender",
      email: env.ethereal.user,
      smtpHost: env.ethereal.host,
      smtpPort: env.ethereal.port,
      smtpUser: env.ethereal.user,
      smtpPass: env.ethereal.pass,
    },
  });

  console.log("Seeded sender:", sender.id, sender.email);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());